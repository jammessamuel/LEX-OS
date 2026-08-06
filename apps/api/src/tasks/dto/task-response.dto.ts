import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  caseId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  taskType!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  priority!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedToId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  dueAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt!: string | null;

  @ApiProperty()
  sourceType!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sourceId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TaskPageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class TaskListResponseDto {
  @ApiProperty({ type: [TaskResponseDto] })
  data!: TaskResponseDto[];

  @ApiProperty({ type: TaskPageInfoDto })
  pageInfo!: TaskPageInfoDto;
}
