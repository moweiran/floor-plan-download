import { Injectable, Logger } from '@nestjs/common';

export interface SimpleScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}

export interface SimpleScrapingOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  /**
   * Make an HTTP request without using proxies
   */
  async request(options: SimpleScrapingOptions): Promise<SimpleScrapingResult> {
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

    try {
      const response = await axios(config);
      
      if (response.status >= 200 && response.status < 300) {
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
}