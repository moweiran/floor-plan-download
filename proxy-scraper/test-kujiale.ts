import { NestFactory } from '@nestjs/core';
import { TestModule } from './src/test-module';
import { TestKujialeService } from './src/services/test-kujiale.service';

/**
 * Test script to verify Kujiale floor plan extraction
 */
async function testKujialeScraping() {
  console.log('Starting Kujiale floor plan extraction test...');
  
  // Create a NestJS application context to access services
  const app = await NestFactory.createApplicationContext(TestModule);
  
  try {
    // Get the Kujiale service
    const kujialeService = app.get(TestKujialeService);
    
    // Target URL for testing
    const testUrl = 'https://www.kujiale.cn/huxing/result/175-7235-58eb-98ce-60c5-0-0?precise=0';
    
    console.log(`Testing floor plan extraction from: ${testUrl}`);
    
    // Test scraping floor plans
    const result = await kujialeService.scrapeFloorPlans(testUrl);
    
    console.log('\n--- Scraping Result ---');
    console.log(`Success: ${result.success}`);
    console.log(`Scraped URL: ${result.scrapedUrl}`);
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    
    if (result.floorPlans && result.floorPlans.length > 0) {
      console.log(`\nFound ${result.floorPlans.length} floor plan(s):`);
      
      result.floorPlans.forEach((plan, index) => {
        console.log(`\n--- Floor Plan ${index + 1} ---`);
        console.log(`ID: ${plan.id}`);
        console.log(`Title: ${plan.title}`);
        console.log(`Image URL: ${plan.imageUrl}`);
        if (plan.designer) console.log(`Designer: ${plan.designer}`);
        if (plan.views !== undefined) console.log(`Views: ${plan.views}`);
        if (plan.likes !== undefined) console.log(`Likes: ${plan.likes}`);
        if (plan.tags) console.log(`Tags: ${plan.tags.join(', ')}`);
        if (plan.roomType) console.log(`Room Type: ${plan.roomType}`);
        if (plan.area) console.log(`Area: ${plan.area}`);
        if (plan.style) console.log(`Style: ${plan.style}`);
      });
      
      // Note: Download functionality not implemented in SimpleKujialeService for this test
    } else {
      console.log('\nNo floor plans found. This could be due to:');
      console.log('- Anti-bot measures on the target website');
      console.log('- Changes in website structure');
      console.log('- Need for more sophisticated scraping techniques');
      console.log('- Geographical restrictions');
    }
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Error running Kujiale test:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

// Run the test
if (require.main === module) {
  testKujialeScraping().catch(console.error);
}