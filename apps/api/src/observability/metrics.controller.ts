import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { MetricsService, type MetricsSnapshot } from './metrics.service.js';

@Controller('metrics')
@Public()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getMetrics(): MetricsSnapshot {
    return this.metricsService.snapshot();
  }
}
