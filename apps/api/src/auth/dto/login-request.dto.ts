import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    format: 'uuid',
    example: '00000000-0000-4000-8000-000000000001',
    description: 'Identificador da organização, necessário apenas antes da autenticação.',
  })
  @IsUUID('4', { message: 'Informe uma organização válida.' })
  organizationId!: string;

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
