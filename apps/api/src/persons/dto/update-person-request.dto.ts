import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { digitsOnly, IsCnpj, IsCpf } from '../identifiers.js';
import { personTypes, type PersonTypeCode } from '../person.constants.js';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdatePersonRequestDto {
  @ApiPropertyOptional({ enum: personTypes })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(personTypes, { message: 'Informe um tipo de pessoa válido.' })
  personType?: PersonTypeCode;

  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Informe o nome completo.' })
  @MinLength(2, { message: 'O nome completo deve ter pelo menos 2 caracteres.' })
  @MaxLength(255, { message: 'O nome completo excede o limite permitido.' })
  fullName?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um nome fantasia válido.' })
  @MaxLength(255, { message: 'O nome fantasia excede o limite permitido.' })
  tradeName?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Aceita pontuação; a resposta é mascarada.' })
  @Transform(({ value }) => digitsOnly(value))
  @IsOptional()
  @IsCpf({ message: 'Informe um CPF válido.' })
  cpf?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Aceita pontuação; a resposta é mascarada.' })
  @Transform(({ value }) => digitsOnly(value))
  @IsOptional()
  @IsCnpj({ message: 'Informe um CNPJ válido.' })
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 32 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um RG válido.' })
  @MaxLength(32, { message: 'O RG excede o limite permitido.' })
  rg?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'Informe a data de nascimento no formato AAAA-MM-DD.' },
  )
  birthDate?: string | null;

  @ApiPropertyOptional({ format: 'email', nullable: true, maxLength: 320 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(320, { message: 'O e-mail excede o limite permitido.' })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 32 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um telefone válido.' })
  @MaxLength(32, { message: 'O telefone excede o limite permitido.' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe uma ocupação válida.' })
  @MaxLength(120, { message: 'A ocupação excede o limite permitido.' })
  occupation?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 80 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um estado civil válido.' })
  @MaxLength(80, { message: 'O estado civil excede o limite permitido.' })
  maritalStatus?: string | null;
}
