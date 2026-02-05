import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyController } from './controllers/proxy.controller';
import { ProxyService } from './services/proxy.service';
import { ProxyRotationService } from './services/proxy-rotation.service';
import { ScrapingService } from './services/scraping.service';
import { KujialeService } from './services/kujiale.service';
import { KujialeController } from './controllers/kujiale.controller';

@Module({
  imports: [],
  controllers: [AppController, ProxyController, KujialeController],
  providers: [AppService, ProxyService, ProxyRotationService, ScrapingService, KujialeService],
})
export class AppNoDbModule {}