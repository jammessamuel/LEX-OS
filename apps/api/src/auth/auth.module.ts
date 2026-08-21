import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditModule } from '../audit/audit.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { LoginAttemptService } from './login-attempt.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { PasswordResetService } from './password-reset.service.js';
import { SecondFactorRepository } from './second-factor.repository.js';
import { SecondFactorService } from './second-factor.service.js';

@Module({
  imports: [RuntimeConfigModule, AuditModule, UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    LoginAttemptService,
    PasswordResetRepository,
    PasswordResetService,
    SecondFactorRepository,
    SecondFactorService,
    AccessTokenGuard,
  ],
  exports: [AuthRepository, AccessTokenGuard],
})
export class AuthModule {}
