import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class CreateChecklistTaskRequestDto {
  @IsOptional()
  @IsIn(priorities, { message: 'Informe uma prioridade válida.' })
  priority?: (typeof priorities)[number];

  @IsOptional()
  @IsUUID('4', { message: 'O responsável deve ser um UUID válido.' })
  assignedToId?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'O prazo deve ser uma data ISO válida.' })
  dueAt?: string;
}
