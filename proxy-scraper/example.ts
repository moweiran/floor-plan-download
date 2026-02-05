import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ScrapingService } from './src/services/scraping.service';
import { ProxyService } from './src/services/proxy.service';

/**
 * Example script demonstrating how to use the proxy scraper
 */
async function runExample() {
  console.log('Starting proxy scraper example...');
  
  // Create a NestJS application context to access services
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the scraping service
    const scrapingService = app.get(ScrapingService);
    const proxyService = app.get(ProxyService);
    
    // First, load proxies from the JSON file
    console.log('Loading proxies from JSON file...');
    await proxyService.loadProxiesFromJson('../../free_proxies.json');
    console.log('Proxies loaded successfully!');
    
    // Get proxy statistics
    const stats = await proxyService.getProxyStats();
    console.log(`Proxy stats: Total=${stats.total}, Active=${stats.active}, Inactive=${stats.inactive}`);
    
    // Example 1: Scrape a website using proxy rotation
    console.log('\n--- Example 1: Simple scraping ---');
    const result1 = await scrapingService.scrape({
      url: 'http://httpbin.org/ip', // This service shows your IP address
      timeout: 10000,
      maxRetries: 3,
    });
    
    console.log('Scraping result:', result1);
    
    // Example 2: Scrape with custom headers
    console.log('\n--- Example 2: Scraping with custom headers ---');
    const result2 = await scrapingService.scrape({
      url: 'http://httpbin.org/headers',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Custom Bot) Proxy Scraper',
        'Accept': 'application/json',
      },
      timeout: 10000,
      maxRetries: 2,
    });
    
    console.log('Headers result:', result2);
    
    // Example 3: Scrape multiple URLs
    console.log('\n--- Example 3: Scraping multiple URLs ---');
    const urls = [
      'http://httpbin.org/ip',
      'http://httpbin.org/user-agent',
      'http://httpbin.org/headers',
    ];
    
    const results = await scrapingService.scrapeMultiple(urls, {
      timeout: 10000,
      maxRetries: 2,
    });
    
    console.log('Multiple scraping results:');
    results.forEach((result, index) => {
      console.log(`  URL ${index + 1}: Success=${result.success}, Proxy=${result.proxyUsed}`);
    });
    
    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error running example:', error.message);
  } finally {
    await app.close();
  }
}

// Run the example
if (require.main === module) {
  runExample().catch(console.error);
}