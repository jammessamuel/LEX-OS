import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';

export const auditActorTypes = ['USER', 'SYSTEM', 'AI', 'INTEGRATION'] as const;

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListAuditLogsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 160, example: 'task.updated' })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @MaxLength(160, { message: 'A ação excede o limite permitido.' })
  @Matches(/^[a-z][a-z0-9_.-]*$/u, { message: 'Informe uma ação de auditoria válida.' })
  action?: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'task' })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @MaxLength(120, { message: 'O tipo de entidade excede o limite permitido.' })
  @Matches(/^[a-z][a-z0-9_-]*$/u, { message: 'Informe um tipo de entidade válido.' })
  entityType?: string;

  @ApiPropertyOptional({ enum: auditActorTypes })
  @IsOptional()
  @IsIn(auditActorTypes, { message: 'Informe um tipo de ator válido.' })
  actorType?: (typeof auditActorTypes)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um usuário válido.' })
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe uma entidade válida.' })
  entityId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Informe uma data inicial válida.' })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Informe uma data final válida.' })
  to?: string;
}
