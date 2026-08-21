import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { REFRESH_COOKIE_NAME, REFRESH_PERSIST_COOKIE_NAME } from './auth.constants.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { AuthService, type IssuedAuthentication } from './auth.service.js';
import { InvitationsService } from '../users/invitations.service.js';
import { AcceptInvitationRequestDto } from './dto/accept-invitation-request.dto.js';
import {
  CompletePasswordResetDto,
  RequestPasswordResetDto,
} from './dto/password-reset-request.dto.js';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto.js';
import { LoginRequestDto } from './dto/login-request.dto.js';
import { PasswordResetService } from './password-reset.service.js';
import { SecondFactorCodeDto } from './dto/second-factor-request.dto.js';
import {
  SecondFactorActivatedDto,
  SecondFactorEnrolmentDto,
  SecondFactorStatusDto,
} from './dto/second-factor-response.dto.js';
import { SecondFactorService } from './second-factor.service.js';
import { Public } from './public.decorator.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly auth: AuthService,
    private readonly invitations: InvitationsService,
    private readonly passwordReset: PasswordResetService,
    private readonly secondFactor: SecondFactorService,
  ) {}

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }

  /**
   * Pedido de redefinicao. Responde 204 sempre — endereco desconhecido, bloqueado ou ainda
   * convidado recebem o mesmo silencio. Diferenciar transformaria a rota em um oraculo de
   * quem trabalha no escritorio, e o slug ja torna o escritorio adivinhavel.
   */
  @Public()
  @Post('password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Pede a redefinição de senha, sem revelar se a conta existe.',
    description:
      'Limitado a três pedidos por hora por identidade, em contador compartilhado no Redis. ' +
      'Contar por IP bloquearia um escritório inteiro atrás de um único NAT.',
  })
  @ApiNoContentResponse()
  async requestPasswordReset(
    @Body() input: RequestPasswordResetDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.passwordReset.request(
      input.organizationSlug,
      input.email,
      request.ip ?? 'unknown',
      getRequestContext() ?? {},
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password-reset/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Conclui a redefinição e derruba as sessões abertas da pessoa.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async completePasswordReset(@Body() input: CompletePasswordResetDto): Promise<void> {
    await this.passwordReset.reset(input.token, input.password, getRequestContext() ?? {});
  }

  /**
   * Aceite de convite. Publico por necessidade: quem aceita ainda nao tem sessao, e o token
   * e a unica prova que ele apresenta. O limite e mais apertado que o do login porque aqui
   * o segredo e adivinhavel por forca bruta em tese, ainda que sejam 256 bits.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invitations/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aceita um convite definindo a senha e ativando o acesso.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  async acceptInvitation(@Body() input: AcceptInvitationRequestDto): Promise<void> {
    await this.invitations.accept(input.token, input.password, getRequestContext() ?? {});
  }

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
    this.#setRefreshCookie(response, issued, input.keepSignedIn === true);
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
    this.#setRefreshCookie(response, issued, request.cookies[REFRESH_PERSIST_COOKIE_NAME] === '1');
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
    response.clearCookie(REFRESH_PERSIST_COOKIE_NAME, this.#baseCookieOptions());
  }

  /**
   * Persistente só a pedido.
   *
   * Sem `expires`, o navegador descarta o cookie ao fechar — e a sessão do servidor continua
   * válida, apenas inalcançável dali. É o padrão adequado a uma máquina compartilhada de
   * escritório, onde a próxima pessoa a abrir o navegador não deve encontrar a sessão da
   * anterior. Quem marca "manter conectado" troca isso conscientemente.
   */
  #setRefreshCookie(response: Response, issued: IssuedAuthentication, keepSignedIn: boolean): void {
    const persistence = keepSignedIn ? { expires: issued.refreshExpiresAt } : {};
    response.cookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      ...this.#baseCookieOptions(),
      ...persistence,
    });
    if (keepSignedIn) {
      response.cookie(REFRESH_PERSIST_COOKIE_NAME, '1', {
        ...this.#baseCookieOptions(),
        ...persistence,
      });
    } else {
      response.clearCookie(REFRESH_PERSIST_COOKIE_NAME, this.#baseCookieOptions());
    }
  }

  #baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.environment === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }

  @Get('second-factor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Informa se o segundo fator está ativo e quantos códigos restam.' })
  @ApiOkResponse({ type: SecondFactorStatusDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  secondFactorStatus(@Req() request: AuthenticatedRequest) {
    return this.secondFactor.status(this.#actor(request));
  }

  @Post('second-factor')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Começa o cadastro do segundo fator e devolve o segredo uma única vez.',
    description:
      'Nada é ativado aqui: o segredo fica guardado cifrado e só passa a valer depois que ' +
      'um código do aplicativo provar que ele chegou. Ativar sem prova trancaria do lado de ' +
      'fora quem começa o cadastro e desiste.',
  })
  @ApiCreatedResponse({ type: SecondFactorEnrolmentDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  beginSecondFactor(@Req() request: AuthenticatedRequest) {
    return this.secondFactor.begin(this.#actor(request), getRequestContext() ?? {});
  }

  @Post('second-factor/activate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ativa o segundo fator e devolve os códigos de recuperação.' })
  @ApiOkResponse({ type: SecondFactorActivatedDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  activateSecondFactor(@Req() request: AuthenticatedRequest, @Body() input: SecondFactorCodeDto) {
    return this.secondFactor.activate(
      this.#actor(request),
      input.code,
      request.ip ?? 'unknown',
      getRequestContext() ?? {},
    );
  }

  @Delete('second-factor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Desliga o segundo fator, exigindo um código do aparelho atual.',
    description:
      'Sem essa prova, quem tomasse uma sessão aberta desligaria o segundo fator e teria a ' +
      'conta inteira — ele protegeria apenas a porta da frente.',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  async disableSecondFactor(
    @Req() request: AuthenticatedRequest,
    @Body() input: SecondFactorCodeDto,
  ): Promise<void> {
    await this.secondFactor.disable(
      this.#actor(request),
      input.code,
      request.ip ?? 'unknown',
      getRequestContext() ?? {},
    );
  }
}
