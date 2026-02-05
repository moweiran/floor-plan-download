import { Controller, Get, Post, Query, HttpCode, HttpStatus, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import { KujialeService } from '../services/kujiale.service';
import { FloorPlanImage, KujialeScrapingResult } from '../services/kujiale.service';

@Controller('kujiale')
export class KujialeController {
  private readonly logger = new Logger(KujialeController.name);

  constructor(private readonly kujialeService: KujialeService) {}

  @Get('floor-plans')
  @HttpCode(HttpStatus.OK)
  async getFloorPlans(
    @Query('url') url: string,
  ): Promise<KujialeScrapingResult> {
    if (!url) {
      return {
        success: false,
        error: 'URL parameter is required',
        scrapedUrl: '',
      };
    }

    try {
      return await this.kujialeService.scrapeFloorPlans(url);
    } catch (error) {
      this.logger.error(`Error scraping floor plans: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        scrapedUrl: url,
      };
    }
  }

  @Post('download-image')
  @HttpCode(HttpStatus.OK)
  async downloadImage(
    @Query('imageUrl') imageUrl: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!imageUrl) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'imageUrl parameter is required' });
      return;
    }

    try {
      const result = await this.kujialeService.downloadImage(imageUrl);

      if (result.success && result.buffer) {
        // Set appropriate headers for image response
        const extension = this.getImageExtension(imageUrl);
        const contentType = this.getMimeType(extension);
        
        res.set({
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="floorplan.${extension}"`,
          'Content-Length': result.buffer.length,
        });
        
        res.send(result.buffer);
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: result.error || 'Failed to download image',
          proxyUsed: result.proxyUsed,
        });
      }
    } catch (error) {
      this.logger.error(`Error downloading image: ${error.message}`, error.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message,
      });
    }
  }

  @Post('batch-scrape')
  @HttpCode(HttpStatus.OK)
  async batchScrape(
    @Query('urls') urls: string,
  ): Promise<KujialeScrapingResult[]> {
    if (!urls) {
      return [{
        success: false,
        error: 'urls parameter is required (comma separated)',
        scrapedUrl: '',
      }];
    }

    try {
      const urlArray = urls.split(',').map(u => u.trim()).filter(u => u);
      return await this.kujialeService.scrapeMultipleUrls(urlArray);
    } catch (error) {
      this.logger.error(`Error in batch scraping: ${error.message}`, error.stack);
      return [{
        success: false,
        error: error.message,
        scrapedUrl: '',
      }];
    }
  }

  @Get('extract-image-urls')
  @HttpCode(HttpStatus.OK)
  async extractImageUrls(
    @Query('url') url: string,
  ): Promise<{ imageUrls: string[]; count: number }> {
    if (!url) {
      return { imageUrls: [], count: 0 };
    }

    try {
      const result = await this.kujialeService.scrapeFloorPlans(url);
      
      if (result.success && result.floorPlans) {
        const imageUrls = result.floorPlans.map(plan => plan.imageUrl).filter(url => url);
        return {
          imageUrls,
          count: imageUrls.length,
        };
      } else {
        return { imageUrls: [], count: 0 };
      }
    } catch (error) {
      this.logger.error(`Error extracting image URLs: ${error.message}`, error.stack);
      return { imageUrls: [], count: 0 };
    }
  }

  private getImageExtension(imageUrl: string): string {
    const extMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
    return extMatch ? extMatch[1].toLowerCase() : 'jpg';
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
    };
    
    return mimeTypes[extension] || 'image/jpeg';
  }
}