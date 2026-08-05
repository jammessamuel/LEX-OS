import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

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
