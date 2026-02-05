import { Module } from '@nestjs/common';
import { ScrapingService } from './services/scraping.service';
import { SimpleKujialeService } from './services/simple-kujiale.service';

@Module({
  providers: [ScrapingService, SimpleKujialeService],
  exports: [ScrapingService, SimpleKujialeService],
})
export class MinimalAppModule {}