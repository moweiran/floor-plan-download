import { Module } from '@nestjs/common';
import { HttpClientService } from './services/http-client.service';
import { TestKujialeService } from './services/test-kujiale.service';

@Module({
  providers: [HttpClientService, TestKujialeService],
  exports: [HttpClientService, TestKujialeService],
})
export class TestModule {}