import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ProxyService } from '../services/proxy.service';
import { Proxy } from '../entities/proxy.entity';

@Controller('proxies')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @Get('random')
  @HttpCode(HttpStatus.OK)
  async getRandomProxy(): Promise<Proxy | null> {
    return await this.proxyService.getRandomProxy();
  }

  @Get('fresh')
  @HttpCode(HttpStatus.OK)
  async getFreshRandomProxy(@Query('minutes') minutesThreshold: number = 10): Promise<Proxy | null> {
    return await this.proxyService.getFreshRandomProxy(Number(minutesThreshold));
  }

  @Get(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validateProxy(@Param('id') id: number): Promise<{ valid: boolean }> {
    const proxy = await this.proxyService.getActiveProxies().then(proxies => 
      proxies.find(p => p.id === id)
    );
    
    if (!proxy) {
      return { valid: false };
    }

    const isValid = await this.proxyService.validateProxy(proxy);
    return { valid: isValid };
  }

  @Post('load-from-json')
  @HttpCode(HttpStatus.CREATED)
  async loadProxiesFromJson(): Promise<{ message: string; count: number }> {
    try {
      // Count proxies before loading
      const statsBefore = await this.proxyService.getProxyStats();
      
      await this.proxyService.loadProxiesFromJson();
      
      // Count proxies after loading
      const statsAfter = await this.proxyService.getProxyStats();
      const newCount = statsAfter.total - statsBefore.total;
      
      return {
        message: `Successfully loaded ${newCount} new proxies from JSON`,
        count: newCount,
      };
    } catch (error) {
      this.logger.error(`Error loading proxies: ${error.message}`);
      return {
        message: `Error loading proxies: ${error.message}`,
        count: 0,
      };
    }
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getProxyStats(): Promise<{ total: number; active: number; inactive: number }> {
    return await this.proxyService.getProxyStats();
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async getActiveProxies(): Promise<Proxy[]> {
    return await this.proxyService.getActiveProxies();
  }

  @Post(':id/mark-used')
  @HttpCode(HttpStatus.OK)
  async markProxyAsUsed(@Param('id') id: number): Promise<{ message: string }> {
    await this.proxyService.markProxyAsUsed(id);
    return { message: 'Proxy marked as used' };
  }

  @Post(':id/mark-success')
  @HttpCode(HttpStatus.OK)
  async markProxySuccess(@Param('id') id: number): Promise<{ message: string }> {
    await this.proxyService.markProxySuccess(id);
    return { message: 'Proxy marked as success' };
  }

  @Post(':id/mark-failure')
  @HttpCode(HttpStatus.OK)
  async markProxyFailed(@Param('id') id: number): Promise<{ message: string }> {
    await this.proxyService.markProxyFailed(id);
    return { message: 'Proxy marked as failure' };
  }
}