import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { auditActorTypes } from './list-audit-logs-query.dto.js';

export class AuditActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Advogada Fictícia' })
  name!: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: auditActorTypes })
  actorType!: (typeof auditActorTypes)[number];

  @ApiPropertyOptional({ nullable: true })
  actorId!: string | null;

  @ApiPropertyOptional({ type: AuditActorDto, nullable: true })
  actor!: AuditActorDto | null;

  @ApiProperty({ example: 'task.updated' })
  action!: string;

  @ApiProperty({ example: 'task' })
  entityType!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  requestId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  correlationId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  processingJobId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data!: AuditLogResponseDto[];

  @ApiProperty({ example: { nextCursor: 'opaque-cursor', hasNextPage: true } })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
