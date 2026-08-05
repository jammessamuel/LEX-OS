import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';

export const processingJobTypes = [
  'OCR',
  'TRANSCRIPTION',
  'DOCUMENT_CLASSIFICATION',
  'ENTITY_EXTRACTION',
  'SUMMARY',
  'EMBEDDING',
  'TIMELINE_GENERATION',
  'CHECKLIST_ANALYSIS',
  'DUPLICATE_DETECTION',
  'FILE_VALIDATION',
  'VIRUS_SCAN',
] as const;

export const processingJobStatuses = [
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'CANCELLED',
] as const;

export class ListProcessingJobsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um caso válido.' })
  caseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um documento válido.' })
  documentId?: string;

  @ApiPropertyOptional({ enum: processingJobTypes })
  @IsOptional()
  @IsIn(processingJobTypes, { message: 'Informe um tipo de processamento válido.' })
  jobType?: (typeof processingJobTypes)[number];

  @ApiPropertyOptional({ enum: processingJobStatuses })
  @IsOptional()
  @IsIn(processingJobStatuses, { message: 'Informe um status de processamento válido.' })
  status?: (typeof processingJobStatuses)[number];
}
