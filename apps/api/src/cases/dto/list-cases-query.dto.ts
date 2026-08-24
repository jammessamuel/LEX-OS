import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { normalizeCnj } from '@lex-os/shared';

import { CursorPaginationQueryDto } from '../../http/pagination.js';
import {
  caseStatuses,
  confidentialityLevels,
  priorities,
  type CaseStatusCode,
  type ConfidentialityLevelCode,
  type PriorityCode,
} from '../case.constants.js';

export class ListCasesQueryDto extends CursorPaginationQueryDto {
  /**
   * Busca única sobre número do processo, código interno e título.
   *
   * O advogado chega com o número na mão — colado do e-mail, com ou sem pontuação. Normalizar
   * aqui faz `00012342720265020001` encontrar o mesmo caso que `0001234-27.2026.5.02.0001`.
   */
  @ApiPropertyOptional({
    example: '0001234-27.2026.5.02.0001',
    description: 'Número do processo, código interno ou parte do título.',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeCnj(value.trim()) : value))
  @IsOptional()
  @IsString({ message: 'Informe um termo de busca válido.' })
  @MinLength(2, { message: 'A busca precisa de pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O termo de busca excede o limite permitido.' })
  search?: string;

  @ApiPropertyOptional({ enum: caseStatuses })
  @IsOptional()
  @IsIn(caseStatuses, { message: 'Informe um status válido.' })
  status?: CaseStatusCode;

  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities, { message: 'Informe uma prioridade válida.' })
  priority?: PriorityCode;

  @ApiPropertyOptional({ enum: confidentialityLevels })
  @IsOptional()
  @IsIn(confidentialityLevels, { message: 'Informe um nível de confidencialidade válido.' })
  confidentialityLevel?: ConfidentialityLevelCode;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um responsável válido.' })
  responsibleUserId?: string;
}
