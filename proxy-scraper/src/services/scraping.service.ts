import { Injectable, Logger } from '@nestjs/common';
import { ProxyRotationService } from './proxy-rotation.service';
import { Proxy, ProxyProtocol } from '../entities/proxy.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  proxyUsed?: number;
  retries?: number;
}

export interface ScrapingOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  successCodes?: number[]; // HTTP status codes that are considered successful
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(private readonly proxyRotationService: ProxyRotationService) {}

  /**
   * Perform a scraping request using available proxies
   */
  async scrape(options: ScrapingOptions): Promise<ScrapingResult> {
    const maxRetries = options.maxRetries ?? 3;
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;
    let proxyUsed: number | undefined;
    let retries = 0;

    // Try direct connection first (without proxy)
    try {
      const directResult = await this.makeRequest(options, null);
      if (directResult.success) {
        return { ...directResult, retries };
      }
    } catch (error) {
      this.logger.debug(`Direct connection failed: ${error.message}`);
    }

    // If direct connection failed, try with proxies
    while (retries <= maxRetries) {
      // Get a proxy from the rotation service
      const proxy = await this.proxyRotationService.getNextProxy();
      
      if (!proxy) {
        this.logger.error('No available proxies found');
        return {
          success: false,
          error: 'No available proxies',
          statusCode: undefined,
          retries,
        };
      }

      proxyUsed = proxy.id;
      this.logger.log(`Attempting scraping with proxy ${proxy.ip}:${proxy.port} (ID: ${proxy.id})`);

      try {
        const result = await this.makeRequest(options, proxy);
        
        if (result.success) {
          await this.proxyRotationService.markSuccessful(proxy.id);
          return { ...result, proxyUsed, retries };
        } else {
          await this.proxyRotationService.markFailed(proxy.id);
          lastError = result.error;
          lastStatusCode = result.statusCode;
        }
      } catch (error) {
        this.logger.warn(`Request failed with proxy ${proxy.id}: ${error.message}`);
        await this.proxyRotationService.markFailed(proxy.id);
        lastError = error.message;
        lastStatusCode = undefined;
      }

      retries++;
      
      // Wait before retrying with another proxy
      if (retries <= maxRetries) {
        const delay = options.retryDelay ?? 1000;
        this.logger.log(`Waiting ${delay}ms before retry #${retries}`);
        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: `Max retries (${maxRetries}) exceeded. Last error: ${lastError || 'Unknown error'}`,
      statusCode: lastStatusCode,
      proxyUsed,
      retries,
    };
  }

  /**
   * Make an HTTP request using either direct connection or proxy
   */
  private async makeRequest(options: ScrapingOptions, proxy: Proxy | null): Promise<ScrapingResult> {
    const axios = require('axios');
    
    const config: any = {
      method: options.method || 'GET',
      url: options.url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...options.headers,
      },
      timeout: options.timeout || 10000,
    };

    if (options.body) {
      config.data = options.body;
    }

    // Add proxy configuration if proxy is provided
    if (proxy) {
      if (proxy.protocol === ProxyProtocol.HTTP || proxy.protocol === ProxyProtocol.HTTPS) {
        config.proxy = {
          protocol: proxy.protocol,
          host: proxy.ip,
          port: proxy.port,
          auth: undefined,
        };
      } else {
        // For SOCKS proxies
        const SocksProxyAgent = require('socks-proxy-agent');
        config.httpAgent = new SocksProxyAgent(`socks://${proxy.ip}:${proxy.port}`);
        config.httpsAgent = new SocksProxyAgent(`socks://${proxy.ip}:${proxy.port}`);
      }
    }

    try {
      const response = await axios(config);
      const successCodes = options.successCodes || [200, 201, 202, 203, 204];
      
      if (successCodes.includes(response.status)) {
        return {
          success: true,
          data: response.data,
          statusCode: response.status,
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        return {
          success: false,
          error: `HTTP ${error.response.status}: ${error.response.statusText}`,
          statusCode: error.response.status,
        };
      } else if (error.request) {
        // Request was made but no response received
        return {
          success: false,
          error: `Request error: ${error.message}`,
          statusCode: undefined,
        };
      } else {
        // Something else happened
        return {
          success: false,
          error: `Setup error: ${error.message}`,
          statusCode: undefined,
        };
      }
    }
  }

  /**
   * Scrape multiple URLs concurrently with proxy rotation
   */
  async scrapeMultiple(urls: string[], options: Omit<ScrapingOptions, 'url'> = {}): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    for (const url of urls) {
      const result = await this.scrape({
        ...options,
        url,
      });
      results.push(result);
      
      // Add delay between requests to be respectful
      if (results.length < urls.length) {
        await this.delay(options.retryDelay || 1000);
      }
    }
    
    return results;
  }

  /**
   * Scrape a website and extract structured data based on selectors
   */
  async scrapeWithSelectors(url: string, selectors: Record<string, string>, options: Omit<ScrapingOptions, 'url'> = {}): Promise<ScrapingResult & { extractedData?: Record<string, any> }> {
    try {
      const result = await this.scrape({ ...options, url });
      
      if (!result.success || !result.data) {
        return result as any;
      }

      // For now, return the raw HTML/data
      // In a real implementation, you'd parse the HTML using a library like cheerio
      const cheerio = require('cheerio');
      const $ = cheerio.load(result.data);
      
      const extractedData: Record<string, any> = {};
      for (const [key, selector] of Object.entries(selectors)) {
        const elements = $(selector);
        if (elements.length === 1) {
          extractedData[key] = elements.first().text().trim();
        } else if (elements.length > 1) {
          extractedData[key] = elements.toArray().map(el => $(el).text().trim());
        } else {
          extractedData[key] = null;
        }
      }

      return {
        ...result,
        extractedData,
      };
    } catch (error) {
      return {
        success: false,
        error: `Scraping with selectors failed: ${error.message}`,
      };
    }
  }

  /**
   * Utility function to introduce delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}