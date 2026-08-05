import { Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { RequestObservabilityMiddleware } from './request-observability.middleware.js';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, RequestObservabilityMiddleware],
  exports: [MetricsService, RequestObservabilityMiddleware],
})
export class ObservabilityModule {}
