import { Injectable, Logger } from '@nestjs/common';
import { ScrapingService } from './scraping.service';

export interface FloorPlanImage {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  designer?: string;
  views?: number;
  likes?: number;
  tags?: string[];
  roomType?: string;
  area?: string;
  style?: string;
  createdAt?: string;
}

export interface KujialeScrapingResult {
  success: boolean;
  floorPlans?: FloorPlanImage[];
  error?: string;
  scrapedUrl: string;
}

@Injectable()
export class SimpleKujialeService {
  private readonly logger = new Logger(SimpleKujialeService.name);

  constructor(
    private readonly scrapingService: ScrapingService,
  ) {}

  /**
   * Scrape floor plan images from Kujiale URL
   */
  async scrapeFloorPlans(url: string): Promise<KujialeScrapingResult> {
    try {
      this.logger.log(`Starting to scrape floor plans from: ${url}`);

      // Use the scraping service without proxy rotation for testing
      const result = await this.scrapingService.scrape({
        url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://www.kujiale.cn/',
        },
        timeout: 15000,
        maxRetries: 2,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch page content',
          scrapedUrl: url,
        };
      }

      // Parse the HTML content to extract floor plan images
      const floorPlans = this.extractFloorPlanImages(result.data, url);
      
      this.logger.log(`Successfully extracted ${floorPlans.length} floor plan images`);
      
      return {
        success: true,
        floorPlans,
        scrapedUrl: url,
      };
    } catch (error) {
      this.logger.error(`Error scraping Kujiale floor plans: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        scrapedUrl: url,
      };
    }
  }

  /**
   * Extract floor plan images from HTML content
   */
  private extractFloorPlanImages(html: string, baseUrl: string): FloorPlanImage[] {
    try {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const floorPlans: FloorPlanImage[] = [];

      // Look for image elements that likely contain floor plan images
      // Different selectors based on common patterns in home design sites
      
      // Selector 1: Images in design showcase items
      $('.design-showcase-item, .design-item, .case-item, .room-design').each((index, element) => {
        const $element = $(element);
        
        // Try to find image
        let imageUrl = '';
        const imgElement = $element.find('img').first();
        if (imgElement.length > 0) {
          imageUrl = imgElement.attr('data-src') || imgElement.attr('src') || imgElement.attr('lazy-src') || '';
          
          // Convert relative URLs to absolute
          if (imageUrl && !imageUrl.startsWith('http')) {
            try {
              const urlObj = new URL(imageUrl, baseUrl);
              imageUrl = urlObj.href;
            } catch (e) {
              // If URL construction fails, skip this image
              return;
            }
          }
        }
        
        if (!imageUrl) return; // Skip if no image found
        
        // Extract additional information
        const title = $element.find('.title, .design-title, .desc, .name').first().text().trim() || 
                     $element.find('img').first().attr('alt') || 
                     `Floor Plan ${floorPlans.length + 1}`;
                     
        const designer = $element.find('.designer, .author, .user-name').first().text().trim();
        const viewsText = $element.find('.views, .view-count').first().text().trim();
        const views = viewsText ? this.parseNumber(viewsText) : undefined;
        const likesText = $element.find('.likes, .like-count, .praise').first().text().trim();
        const likes = likesText ? this.parseNumber(likesText) : undefined;
        
        // Extract room type, area, style if available
        const roomType = $element.find('.room-type, .type').first().text().trim();
        const area = $element.find('.area, .size').first().text().trim();
        const style = $element.find('.style, .tag').first().text().trim();
        
        // Look for tags
        const tags: string[] = [];
        $element.find('.tags .tag, .labels .label, .tag-item').each((idx, tagEl) => {
          const tagText = $(tagEl).text().trim();
          if (tagText) tags.push(tagText);
        });
        
        const floorPlan: FloorPlanImage = {
          id: `${baseUrl}-${index}`,
          title,
          imageUrl,
          designer: designer || undefined,
          views,
          likes,
          tags: tags.length > 0 ? tags : undefined,
          roomType: roomType || undefined,
          area: area || undefined,
          style: style || undefined,
        };
        
        floorPlans.push(floorPlan);
      });
      
      // Selector 2: More general image search for floor plans
      $('img[src*="floor"], img[src*="plan"], img[src*="huxing"], img[src*="layout"], ' +
        'img[data-src*="floor"], img[data-src*="plan"], img[data-src*="huxing"], img[data-src*="layout"]').each((index, element) => {
        const $element = $(element);
        let imageUrl = $element.attr('data-src') || $element.attr('src') || $element.attr('lazy-src') || '';
        
        // Convert relative URLs to absolute
        if (imageUrl && !imageUrl.startsWith('http')) {
          try {
            const urlObj = new URL(imageUrl, baseUrl);
            imageUrl = urlObj.href;
          } catch (e) {
            return;
          }
        }
        
        if (!imageUrl) return;
        
        // Check if this image is already added
        if (floorPlans.some(fp => fp.imageUrl === imageUrl)) {
          return;
        }
        
        const title = $element.attr('alt') || `Floor Plan ${floorPlans.length + 1}`;
        
        const floorPlan: FloorPlanImage = {
          id: `${baseUrl}-general-${index}`,
          title,
          imageUrl,
        };
        
        floorPlans.push(floorPlan);
      });
      
      // Remove duplicates based on image URL
      const uniqueFloorPlans = floorPlans.filter((plan, index, self) =>
        index === self.findIndex(p => p.imageUrl === plan.imageUrl)
      );

      return uniqueFloorPlans;
    } catch (error) {
      this.logger.error(`Error extracting floor plan images: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Parse numbers from text (handles formats like "1.2k" or "1,234")
   */
  private parseNumber(text: string): number | undefined {
    if (!text) return undefined;
    
    // Remove non-numeric characters except dots and commas
    const cleaned = text.replace(/[^\d.,]/g, '');
    
    if (!cleaned) return undefined;
    
    // Handle "k" notation (thousands)
    if (text.toLowerCase().includes('k')) {
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : Math.round(num * 1000);
    }
    
    // Handle comma-separated numbers
    const numString = cleaned.replace(/,/g, '');
    const num = parseFloat(numString);
    
    return isNaN(num) ? undefined : num;
  }
}