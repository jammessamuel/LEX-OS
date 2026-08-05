import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/public.decorator.js';
import { HealthService, type ReadinessReport } from './health.service.js';

interface LivenessReport {
  status: 'up';
}

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness(): LivenessReport {
    return { status: 'up' };
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessReport> {
    const report = await this.healthService.checkReadiness();

    if (report.status === 'down') {
      response.status(503);
    }

    return report;
  }
}
