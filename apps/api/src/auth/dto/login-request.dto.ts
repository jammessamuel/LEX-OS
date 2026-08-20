import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Mesma forma aceita pela constraint `organizations_slug_format` no banco. */
export const organizationSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

export class LoginRequestDto {
  @ApiProperty({
    example: 'lex-os-demonstracao',
    maxLength: 63,
    description:
      'Identidade digitável do escritório. Substitui o UUID: ela circula em link de convite ' +
      'e é o que a pessoa digita todo dia.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'Informe o escritório.' })
  @MaxLength(63, { message: 'O identificador do escritório excede o limite permitido.' })
  @Matches(organizationSlugPattern, { message: 'Informe um escritório válido.' })
  organizationSlug!: string;

  @ApiProperty({ example: 'admin@lexos.invalid', maxLength: 320 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(320, { message: 'O e-mail excede o limite permitido.' })
  email!: string;

  @ApiProperty({ format: 'password', writeOnly: true, minLength: 8, maxLength: 128 })
  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha excede o limite permitido.' })
  password!: string;
}
