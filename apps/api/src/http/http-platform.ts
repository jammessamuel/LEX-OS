import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { RuntimeConfig } from '@lex-os/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { REFRESH_COOKIE_NAME } from '../auth/auth.constants.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { createValidationPipe } from './validation.js';

export function configureHttpPlatform(app: INestApplication, config: RuntimeConfig): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.service.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID', 'X-Request-ID'],
    exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle('LEX OS API')
    .setDescription('API multi-tenant do LEX OS. Exemplos contêm somente dados fictícios.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addCookieAuth(REFRESH_COOKIE_NAME, { type: 'apiKey', in: 'cookie' }, 'refresh-cookie')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup('docs', app, documentFactory, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs/openapi.json',
    raw: ['json'],
  });
}
