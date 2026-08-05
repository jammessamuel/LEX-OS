import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  caseStatuses,
  confidentialityLevels,
  priorities,
  type CaseStatusCode,
  type ConfidentialityLevelCode,
  type PriorityCode,
} from '../case.constants.js';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function upper(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateCaseRequestDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @Transform(({ value }) => upper(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Informe o código interno.' })
  @Matches(/^[A-Z0-9][A-Z0-9._/-]{0,79}$/u, { message: 'Informe um código interno válido.' })
  internalCode?: string;

  @ApiPropertyOptional({ minLength: 3, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Informe o título do caso.' })
  @MinLength(3, { message: 'O título deve ter pelo menos 3 caracteres.' })
  @MaxLength(255, { message: 'O título excede o limite permitido.' })
  title?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 20_000 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe uma descrição válida.' })
  @MaxLength(20_000, { message: 'A descrição excede o limite permitido.' })
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }) => upper(value))
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[A-Z0-9_]{2,120}$/u, { message: 'Informe uma área jurídica válida.' })
  legalArea?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }) => upper(value))
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[A-Z0-9_]{2,120}$/u, { message: 'Informe um tipo de caso válido.' })
  caseType?: string;

  @ApiPropertyOptional({ enum: caseStatuses })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(caseStatuses, { message: 'Informe um status válido.' })
  status?: CaseStatusCode;

  @ApiPropertyOptional({ enum: priorities })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(priorities, { message: 'Informe uma prioridade válida.' })
  priority?: PriorityCode;

  @ApiPropertyOptional({ enum: confidentialityLevels })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(confidentialityLevels, { message: 'Informe um nível de confidencialidade válido.' })
  confidentialityLevel?: ConfidentialityLevelCode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um responsável válido.' })
  responsibleUserId?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'Informe uma data de abertura válida.' },
  )
  openedAt?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'Informe uma data de encerramento válida.' },
  )
  closedAt?: string | null;
}
