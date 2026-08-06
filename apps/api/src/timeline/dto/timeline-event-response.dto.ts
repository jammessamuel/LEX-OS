import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimelineExtractionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  modelName!: string;

  @ApiPropertyOptional({ nullable: true })
  modelVersion!: string | null;

  @ApiPropertyOptional({ nullable: true })
  promptVersion!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class TimelineEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  occurredAt!: string | null;

  @ApiProperty()
  datePrecision!: string;

  @ApiProperty()
  importance!: string;

  @ApiProperty()
  sourceType!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sourceId!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  sourceLocator!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: TimelineExtractionSummaryDto, nullable: true })
  extraction!: TimelineExtractionSummaryDto | null;

  @ApiPropertyOptional({ nullable: true })
  confidenceScore!: number | null;

  @ApiProperty()
  createdByActorType!: string;

  @ApiProperty()
  confirmedByUser!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  confirmedById!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  confirmedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TimelineEventPageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class TimelineEventListResponseDto {
  @ApiProperty({ type: [TimelineEventResponseDto] })
  data!: TimelineEventResponseDto[];

  @ApiProperty({ type: TimelineEventPageInfoDto })
  pageInfo!: TimelineEventPageInfoDto;
}
