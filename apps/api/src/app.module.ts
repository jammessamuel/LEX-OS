import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccessControlModule } from './access-control/access-control.module.js';
import { PermissionsGuard } from './access-control/permissions.guard.js';
import { AppController } from './app.controller.js';
import { AccessTokenGuard } from './auth/access-token.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CasesModule } from './cases/cases.module.js';
import { RuntimeConfigModule } from './config/runtime-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ExtractionsModule } from './extractions/extractions.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { RequestObservabilityMiddleware } from './observability/request-observability.middleware.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { ParticipantsModule } from './participants/participants.module.js';
import { PersonsModule } from './persons/persons.module.js';
import { ProcessingModule } from './processing/processing.module.js';

@Module({
  imports: [
    RuntimeConfigModule,
    DatabaseModule,
    ObservabilityModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    AccessControlModule,
    OrganizationsModule,
    PersonsModule,
    CasesModule,
    ParticipantsModule,
    FilesModule,
    DocumentsModule,
    ExtractionsModule,
    ProcessingModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestObservabilityMiddleware).forRoutes('{*path}');
  }
}
