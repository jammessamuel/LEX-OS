import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';

export const extractionTypes = [
  'OCR',
  'TRANSCRIPTION',
  'CLASSIFICATION',
  'SUMMARY',
  'ENTITY_EXTRACTION',
  'IMAGE_ANALYSIS',
  'TIMELINE_ANALYSIS',
  'CHECKLIST_ANALYSIS',
] as const;

export class ListExtractionsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ enum: extractionTypes })
  @IsOptional()
  @IsIn(extractionTypes, { message: 'Informe um tipo de extração válido.' })
  extractionType?: (typeof extractionTypes)[number];
}
