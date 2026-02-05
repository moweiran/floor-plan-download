import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { Proxy } from '../entities/proxy.entity';

@Injectable()
export class ProxyRotationService {
  private readonly logger = new Logger(ProxyRotationService.name);
  
  // Track currently used proxies to avoid duplicates in quick succession
  private recentlyUsed: Map<number, Date> = new Map();
  private maxRecentSize = 10; // Maximum size of recent proxy history
  
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get the next available proxy using round-robin or random selection
   */
  async getNextProxy(strategy: 'random' | 'round-robin' = 'random'): Promise<Proxy | null> {
    if (strategy === 'random') {
      return await this.getRandomProxyWithCooldown();
    } else {
      return await this.getRoundRobinProxy();
    }
  }

  /**
   * Get a random proxy that's not in cooldown
   */
  private async getRandomProxyWithCooldown(): Promise<Proxy | null> {
    const activeProxies = await this.proxyService.getActiveProxies();
    
    // Filter out recently used proxies
    const filteredProxies = activeProxies.filter(proxy => {
      const lastUsed = this.recentlyUsed.get(proxy.id);
      if (!lastUsed) return true;
      
      // Allow reusing proxy after 2 minutes
      const cooldownPeriod = 2 * 60 * 1000; // 2 minutes in milliseconds
      return Date.now() - lastUsed.getTime() > cooldownPeriod;
    });
    
    if (filteredProxies.length === 0) {
      // If all proxies are in cooldown, use any active proxy
      return await this.proxyService.getRandomProxy();
    }
    
    const selectedProxy = filteredProxies[Math.floor(Math.random() * filteredProxies.length)];
    this.trackUsedProxy(selectedProxy.id);
    
    return selectedProxy;
  }

  /**
   * Get proxy using round-robin strategy
   */
  private async getRoundRobinProxy(): Promise<Proxy | null> {
    // For simplicity, we'll use a modified random approach that tracks usage
    const activeProxies = await this.proxyService.getActiveProxies();
    
    if (activeProxies.length === 0) {
      return null;
    }
    
    // Sort by usage count to implement a basic round-robin
    activeProxies.sort((a, b) => a.usage_count - b.usage_count);
    
    // Select from the least used proxies to distribute load
    const leastUsedProxies = activeProxies.slice(0, Math.min(5, activeProxies.length));
    const selectedProxy = leastUsedProxies[Math.floor(Math.random() * leastUsedProxies.length)];
    
    this.trackUsedProxy(selectedProxy.id);
    
    return selectedProxy;
  }

  /**
   * Track a proxy as recently used
   */
  private trackUsedProxy(proxyId: number): void {
    this.recentlyUsed.set(proxyId, new Date());
    
    // Maintain size limit
    if (this.recentlyUsed.size > this.maxRecentSize) {
      // Remove the oldest entry
      const oldestKey = this.recentlyUsed.keys().next().value;
      this.recentlyUsed.delete(oldestKey);
    }
  }

  /**
   * Mark proxy as successful and return it to the pool
   */
  async markSuccessful(proxyId: number): Promise<void> {
    await this.proxyService.markProxySuccess(proxyId);
    this.logger.log(`Proxy ${proxyId} marked as successful`);
  }

  /**
   * Mark proxy as failed and temporarily disable if failure threshold reached
   */
  async markFailed(proxyId: number, failureThreshold: number = 5): Promise<void> {
    await this.proxyService.markProxyFailed(proxyId);
    
    // Check if this proxy has exceeded failure threshold
    const proxy = await this.proxyService.getActiveProxies()
      .then(proxies => proxies.find(p => p.id === proxyId));
      
    if (proxy && proxy.failure_count >= failureThreshold) {
      await this.proxyService.disableProxy(proxyId);
      this.logger.warn(`Proxy ${proxyId} disabled due to reaching failure threshold (${failureThreshold})`);
    }
    
    this.logger.log(`Proxy ${proxyId} marked as failed`);
  }

  /**
   * Validate and clean the proxy pool periodically
   */
  async validateAndCleanProxyPool(): Promise<void> {
    const activeProxies = await this.proxyService.getActiveProxies();
    const validationPromises = activeProxies.map(async proxy => {
      const isValid = await this.proxyService.validateProxy(proxy, 5000); // Shorter timeout for validation
      
      if (!isValid) {
        await this.proxyService.disableProxy(proxy.id);
        this.logger.warn(`Proxy ${proxy.id} disabled due to validation failure`);
      }
      
      return { proxyId: proxy.id, valid: isValid };
    });
    
    const results = await Promise.all(validationPromises);
    const invalidCount = results.filter(r => !r.valid).length;
    
    this.logger.log(`Proxy validation completed. ${invalidCount} proxies disabled.`);
  }

  /**
   * Get proxy usage statistics
   */
  async getUsageStats(): Promise<any> {
    const stats = await this.proxyService.getProxyStats();
    const activeProxies = await this.proxyService.getActiveProxies();
    
    // Calculate average success rate
    let avgSuccessRate = 0;
    if (activeProxies.length > 0) {
      const totalUsage = activeProxies.reduce((sum, proxy) => sum + proxy.usage_count, 0);
      const totalSuccess = activeProxies.reduce((sum, proxy) => sum + proxy.success_count, 0);
      avgSuccessRate = totalUsage > 0 ? (totalSuccess / totalUsage) * 100 : 0;
    }
    
    return {
      ...stats,
      avgSuccessRate: parseFloat(avgSuccessRate.toFixed(2)),
      recentlyUsedCount: this.recentlyUsed.size,
    };
  }
}