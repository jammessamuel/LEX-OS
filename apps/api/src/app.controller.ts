import { Controller, Get } from '@nestjs/common';

import { Public } from './auth/public.decorator.js';

interface ServiceInfo {
  name: 'lex-os-api';
  status: 'operational';
}

@Controller()
@Public()
export class AppController {
  @Get()
  getServiceInfo(): ServiceInfo {
    return {
      name: 'lex-os-api',
      status: 'operational',
    };
  }
}
