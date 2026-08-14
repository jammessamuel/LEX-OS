import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

const taskStatuses = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class UpdateTaskRequestDto {
  @ApiPropertyOptional({ enum: taskStatuses })
  @IsOptional()
  @IsIn(taskStatuses, { message: 'Informe um status de tarefa válido.' })
  status?: (typeof taskStatuses)[number];

  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities, { message: 'Informe uma prioridade válida.' })
  priority?: (typeof priorities)[number];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'O responsável deve ser um UUID válido.' })
  assignedToId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'O prazo deve ser uma data ISO válida.' })
  dueAt?: string | null;
}
