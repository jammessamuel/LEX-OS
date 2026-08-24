import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TaskResponseDto } from './task-response.dto.js';

export class AgendaCaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'DEMO-0001' })
  internalCode!: string;

  @ApiPropertyOptional({ example: '0001234-27.2026.5.02.0001', nullable: true })
  cnjNumber!: string | null;

  @ApiProperty()
  title!: string;
}

export class AgendaAssigneeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Advogada Fictícia' })
  name!: string;
}

export class AgendaTaskDto extends TaskResponseDto {
  /** Nulo quando a tarefa é do escritório e não de um processo. */
  @ApiPropertyOptional({ type: AgendaCaseDto, nullable: true })
  case!: AgendaCaseDto | null;

  @ApiPropertyOptional({ type: AgendaAssigneeDto, nullable: true })
  assignedTo!: AgendaAssigneeDto | null;
}

export class AgendaBucketDto {
  @ApiProperty({ type: [AgendaTaskDto] })
  tasks!: AgendaTaskDto[];

  /** Quantos existem ao todo, mesmo além do teto devolvido. */
  @ApiProperty({ example: 12 })
  total!: number;

  /** Verdadeiro quando `total` excede o teto: a tela precisa dizer que a lista foi cortada. */
  @ApiProperty({ example: false })
  truncated!: boolean;
}

export class AgendaRangeDto {
  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  /** Instante em que o servidor respondeu — o que decide o que já está vencido. */
  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}

export class AgendaResponseDto {
  @ApiProperty({ type: AgendaRangeDto })
  range!: AgendaRangeDto;

  /** Vencidos antes do início da janela. Aparecem sempre; prazo perdido não se esconde. */
  @ApiProperty({ type: AgendaBucketDto })
  overdue!: AgendaBucketDto;

  @ApiProperty({ type: AgendaBucketDto })
  upcoming!: AgendaBucketDto;
}
