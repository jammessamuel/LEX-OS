import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtractedEntityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CONTRACT_NUMBER' })
  entityType!: string;

  @ApiProperty({ example: 'LEX-2026-0001' })
  normalizedValue!: string;

  @ApiProperty({ example: 'LEX-2026-0001' })
  originalValue!: string;

  @ApiPropertyOptional({ nullable: true })
  pageNumber!: number | null;

  @ApiPropertyOptional({ nullable: true })
  startOffset!: number | null;

  @ApiPropertyOptional({ nullable: true })
  endOffset!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 0.98 })
  confidenceScore!: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  linkedPersonId!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: unknown;

  @ApiProperty()
  confirmedByUser!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  confirmedById!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  confirmedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ExtractionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  documentId!: string;

  @ApiProperty({ example: 'OCR' })
  extractionType!: string;

  @ApiProperty({ example: 'lex-os-mock' })
  provider!: string;

  @ApiProperty({ example: 'mock-v1' })
  modelName!: string;

  @ApiPropertyOptional({ nullable: true })
  modelVersion!: string | null;

  @ApiProperty({ example: 'mock-v1:00000000-0000-4000-8000-000000000000' })
  executionId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  rawText!: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  structuredData!: unknown | null;

  @ApiPropertyOptional({ nullable: true, example: 0.98 })
  confidenceScore!: number | null;

  @ApiPropertyOptional({ nullable: true })
  processingTimeMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  promptVersion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiProperty({ type: [ExtractedEntityResponseDto] })
  entities!: ExtractedEntityResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ExtractionPageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class ExtractionListResponseDto {
  @ApiProperty({ type: [ExtractionResponseDto] })
  data!: ExtractionResponseDto[];

  @ApiProperty({ type: ExtractionPageInfoDto })
  pageInfo!: ExtractionPageInfoDto;
}
