import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';

const processingStatuses = [
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'NEEDS_REVIEW',
  'FAILED',
] as const;

export class ListDocumentsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um tipo documental válido.' })
  documentTypeId?: string;

  @ApiPropertyOptional({ enum: processingStatuses })
  @IsOptional()
  @IsIn(processingStatuses, { message: 'Informe um status de processamento válido.' })
  processingStatus?: (typeof processingStatuses)[number];
}
