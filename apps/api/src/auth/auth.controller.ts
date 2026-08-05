import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { AuthService, type IssuedAuthentication } from './auth.service.js';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto.js';
import { LoginRequestDto } from './dto/login-request.dto.js';
import { Public } from './public.decorator.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica um usuário de uma organização.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async login(
    @Body() input: LoginRequestDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponseDto> {
    const issued = await this.auth.login(input, request.ip ?? 'unknown', getRequestContext() ?? {});
    this.#setRefreshCookie(response, issued);
    return issued.response;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({ summary: 'Rotaciona uma sessão de atualização.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponseDto> {
    const issued = await this.auth.refresh(
      request.cookies[REFRESH_COOKIE_NAME],
      getRequestContext() ?? {},
    );
    this.#setRefreshCookie(response, issued);
    return issued.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoga a família da sessão autenticada.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.actor === undefined) {
      return;
    }

    await this.auth.logout(request.actor, getRequestContext() ?? {});
    response.clearCookie(REFRESH_COOKIE_NAME, this.#baseCookieOptions());
  }

  #setRefreshCookie(response: Response, issued: IssuedAuthentication): void {
    response.cookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      ...this.#baseCookieOptions(),
      expires: issued.refreshExpiresAt,
    });
  }

  #baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.environment === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }
}
