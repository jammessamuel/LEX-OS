import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessingJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  caseId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fileId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  documentId!: string | null;

  @ApiProperty({ example: 'OCR' })
  jobType!: string;

  @ApiProperty({ example: 'PROCESSING' })
  status!: string;

  @ApiProperty()
  priority!: number;

  @ApiProperty()
  attempts!: number;

  @ApiProperty()
  version!: number;

  @ApiPropertyOptional({ nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modelVersion!: string | null;

  @ApiProperty({ example: '0.000000' })
  reservedCostAmount!: string;

  @ApiPropertyOptional({ nullable: true, example: '0.000000' })
  costAmount!: string | null;

  @ApiProperty({ example: 'BRL' })
  costCurrency!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  outputMetadata!: unknown | null;

  @ApiPropertyOptional({ nullable: true })
  errorCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ProcessingJobPageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class ProcessingJobListResponseDto {
  @ApiProperty({ type: [ProcessingJobResponseDto] })
  data!: ProcessingJobResponseDto[];

  @ApiProperty({ type: ProcessingJobPageInfoDto })
  pageInfo!: ProcessingJobPageInfoDto;
}
