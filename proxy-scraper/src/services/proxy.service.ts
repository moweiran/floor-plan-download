import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Proxy, ProxyProtocol, ProxyAnonymity } from '../entities/proxy.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ProxyData {
  source: string;
  protocol: string;
  ip: string;
  port: number;
  country_code: string;
  in_chinese_mainland: boolean;
  anonymity: string;
  delay: number | null;
  test_timeout: number;
  test_url: string;
  test_headers: Record<string, string>;
  failed_connection_default_timeout: number;
  created_at: string;
  extra: Record<string, any>;
  _tcp_connect_delay: number | null;
  _http_connect_delay: number | null;
}

interface ProxiflyData {
  ProxiflyProxiedSession: ProxyData[];
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    @InjectRepository(Proxy)
    private proxyRepository: Repository<Proxy>,
  ) {}

  /**
   * Load proxies from JSON file and save to database
   */
  async loadProxiesFromJson(jsonFilePath: string = '../../../free_proxies.json'): Promise<void> {
    try {
      const fullPath = path.join(__dirname, jsonFilePath);
      const data: ProxiflyData = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
      
      const proxiesToSave: Partial<Proxy>[] = data.ProxiflyProxiedSession.map(proxyData => ({
        ip: proxyData.ip,
        port: proxyData.port,
        protocol: this.mapProtocol(proxyData.protocol),
        country_code: proxyData.country_code,
        in_chinese_mainland: proxyData.in_chinese_mainland,
        anonymity: this.mapAnonymity(proxyData.anonymity),
        delay: proxyData.delay,
        test_timeout: proxyData.test_timeout,
        test_url: proxyData.test_url,
        test_headers: proxyData.test_headers,
        extra: proxyData.extra,
        is_active: true, // Initially set all proxies as active
      }));

      // Batch save proxies to database
      await this.proxyRepository.save(proxiesToSave, { chunk: 100 });
      
      this.logger.log(`Successfully loaded ${proxiesToSave.length} proxies from JSON file`);
    } catch (error) {
      this.logger.error(`Error loading proxies from JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map string protocol to enum
   */
  private mapProtocol(protocol: string): ProxyProtocol {
    switch (protocol.toLowerCase()) {
      case 'http':
        return ProxyProtocol.HTTP;
      case 'https':
        return ProxyProtocol.HTTPS;
      case 'socks4':
        return ProxyProtocol.SOCKS4;
      case 'socks5':
        return ProxyProtocol.SOCKS5;
      default:
        return ProxyProtocol.HTTP; // Default fallback
    }
  }

  /**
   * Map string anonymity level to enum
   */
  private mapAnonymity(anonymity: string): ProxyAnonymity {
    switch (anonymity.toLowerCase()) {
      case 'transparent':
        return ProxyAnonymity.TRANSPARENT;
      case 'anonymous':
        return ProxyAnonymity.ANONYMOUS;
      case 'elite':
        return ProxyAnonymity.ELITE;
      default:
        return ProxyAnonymity.TRANSPARENT; // Default fallback
    }
  }

  /**
   * Get a random active proxy from the pool
   */
  async getRandomProxy(): Promise<Proxy | null> {
    const activeProxies = await this.proxyRepository.find({
      where: { is_active: true },
      order: { id: 'ASC' }, // Using ASC instead of RANDOM for compatibility
      take: 1,
    });

    // Randomly pick from the results
    if (activeProxies.length === 0) return null;
    return activeProxies[Math.floor(Math.random() * activeProxies.length)];
  }

  /**
   * Get a random proxy that hasn't been used recently
   */
  async getFreshRandomProxy(minutesThreshold: number = 10): Promise<Proxy | null> {
    const dateThreshold = new Date();
    dateThreshold.setMinutes(dateThreshold.getMinutes() - minutesThreshold);

    const freshProxies = await this.proxyRepository.find({
      where: [
        { is_active: true, last_used_at: LessThan(dateThreshold) },
        { is_active: true, last_used_at: IsNull() },
      ],
      order: { id: 'ASC' },
      take: 1,
    });

    // Randomly pick from the results
    if (freshProxies.length === 0) return null;
    return freshProxies[Math.floor(Math.random() * freshProxies.length)];
  }

  /**
   * Mark a proxy as used
   */
  async markProxyAsUsed(proxyId: number): Promise<void> {
    await this.proxyRepository.update(proxyId, {
      last_used_at: new Date(),
      usage_count: () => '"usage_count" + 1',
    });
  }

  /**
   * Mark a proxy as successful
   */
  async markProxySuccess(proxyId: number): Promise<void> {
    await this.proxyRepository.update(proxyId, {
      success_count: () => '"success_count" + 1',
    });
  }

  /**
   * Mark a proxy as failed
   */
  async markProxyFailed(proxyId: number): Promise<void> {
    await this.proxyRepository.update(proxyId, {
      failure_count: () => '"failure_count" + 1',
    });
  }

  /**
   * Disable a proxy (mark as inactive)
   */
  async disableProxy(proxyId: number): Promise<void> {
    await this.proxyRepository.update(proxyId, {
      is_active: false,
    });
  }

  /**
   * Get all active proxies
   */
  async getActiveProxies(): Promise<Proxy[]> {
    return await this.proxyRepository.find({
      where: { is_active: true },
    });
  }

  /**
   * Get proxy statistics
   */
  async getProxyStats(): Promise<{ total: number; active: number; inactive: number }> {
    const total = await this.proxyRepository.count();
    const active = await this.proxyRepository.count({ where: { is_active: true } });
    const inactive = total - active;

    return { total, active, inactive };
  }

  /**
   * Validate a proxy by attempting to connect to a test URL
   */
  async validateProxy(proxy: Proxy, timeoutMs: number = 10000): Promise<boolean> {
    const axios = require('axios');
    
    try {
      // Construct proxy config
      const proxyConfig = {
        protocol: proxy.protocol,
        host: proxy.ip,
        port: proxy.port,
        auth: undefined, // Add authentication if needed
      };

      // Make a test request using the proxy
      const config: any = {
        timeout: timeoutMs,
        headers: proxy.test_headers || {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      // Handle different proxy protocols
      if (proxy.protocol === ProxyProtocol.HTTP || proxy.protocol === ProxyProtocol.HTTPS) {
        config.proxy = proxyConfig;
      } else {
        // For SOCKS proxies, we need to use a different approach
        const SocksProxyAgent = require('socks-proxy-agent');
        config.httpAgent = new SocksProxyAgent(`socks://${proxy.ip}:${proxy.port}`);
        config.httpsAgent = new SocksProxyAgent(`socks://${proxy.ip}:${proxy.port}`);
      }

      const response = await axios.get(proxy.test_url || 'http://httpbin.org/ip', config);

      // Check if response is valid
      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Proxy ${proxy.ip}:${proxy.port} validated successfully`);
        return true;
      }
    } catch (error) {
      this.logger.warn(`Proxy ${proxy.ip}:${proxy.port} validation failed: ${error.message}`);
    }

    return false;
  }
}