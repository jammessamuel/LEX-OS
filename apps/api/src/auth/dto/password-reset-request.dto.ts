import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { organizationSlugPattern } from './login-request.dto.js';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'lex-os-demonstracao', maxLength: 63 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'Informe o escritório.' })
  @MaxLength(63, { message: 'O identificador do escritório excede o limite permitido.' })
  @Matches(organizationSlugPattern, { message: 'Informe um escritório válido.' })
  organizationSlug!: string;

  @ApiProperty({ example: 'ana@escritorio.invalid', maxLength: 320 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(320, { message: 'O e-mail excede o limite permitido.' })
  email!: string;
}

export class CompletePasswordResetDto {
  @ApiProperty({ writeOnly: true, maxLength: 128 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o código do pedido.' })
  @MinLength(20, { message: 'Informe um pedido válido.' })
  @MaxLength(128, { message: 'Informe um pedido válido.' })
  token!: string;

  @ApiProperty({ format: 'password', writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString({ message: 'Informe a senha.' })
  // Doze, igual ao aceite do convite: os dois criam senha, e o piso tem de ser o mesmo.
  @MinLength(12, { message: 'A senha deve ter pelo menos 12 caracteres.' })
  @MaxLength(128, { message: 'A senha excede o limite permitido.' })
  password!: string;
}
