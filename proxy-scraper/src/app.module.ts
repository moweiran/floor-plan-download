import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProxyController } from './controllers/proxy.controller';
import { KujialeController } from './controllers/kujiale.controller';
import { ProxyService } from './services/proxy.service';
import { ProxyRotationService } from './services/proxy-rotation.service';
import { ScrapingService } from './services/scraping.service';
import { Proxy } from './entities/proxy.entity';
import { KujialeService } from './services/kujiale.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'proxy_scraper',
      entities: [Proxy],
      synchronize: true, // Note: Don't use synchronize in production
      logging: ['error'],
    }),
    TypeOrmModule.forFeature([Proxy]),
  ],
  controllers: [AppController, ProxyController, KujialeController],
  providers: [AppService, ProxyService, ProxyRotationService, ScrapingService, KujialeService],
})
export class AppModule {}
