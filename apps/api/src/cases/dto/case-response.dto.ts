import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  caseStatuses,
  confidentialityLevels,
  processingBudgetStatuses,
  priorities,
  type CaseStatusCode,
  type ConfidentialityLevelCode,
  type PriorityCode,
  type ProcessingBudgetStatusCode,
} from '../case.constants.js';

export class CaseResponsibleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Advogada Fictícia' })
  name!: string;
}

export class CaseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'DEMO-0002' })
  internalCode!: string;

  @ApiPropertyOptional({ example: '0001234-27.2026.5.02.0001', nullable: true })
  cnjNumber!: string | null;

  /** Segmento do Judiciário por extenso, derivado do número — a tela não mostra dígito solto. */
  @ApiPropertyOptional({ example: 'Justiça do Trabalho', nullable: true })
  cnjSegment!: string | null;

  @ApiPropertyOptional({ example: 'TRT da 2ª Região', nullable: true })
  court!: string | null;

  @ApiPropertyOptional({ example: '1ª Vara do Trabalho de São Paulo', nullable: true })
  courtDivision!: string | null;

  @ApiProperty({ example: 'Caso fictício para validação' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'DIREITO_TRABALHISTA' })
  legalArea!: string;

  @ApiProperty({ example: 'RECLAMACAO_TRABALHISTA' })
  caseType!: string;

  @ApiProperty({ enum: caseStatuses })
  status!: CaseStatusCode;

  @ApiProperty({ enum: priorities })
  priority!: PriorityCode;

  @ApiProperty({ enum: confidentialityLevels })
  confidentialityLevel!: ConfidentialityLevelCode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  responsibleUserId!: string | null;

  @ApiProperty({ type: CaseResponsibleDto, nullable: true })
  responsible!: CaseResponsibleDto | null;

  @ApiProperty({ example: '25.000000' })
  processingCostLimitAmount!: string;

  @ApiProperty({ example: '2.500000' })
  processingCostSpentAmount!: string;

  @ApiProperty({ example: '0.000000' })
  processingCostReservedAmount!: string;

  @ApiProperty({ example: 'BRL' })
  processingCostCurrency!: string;

  @ApiProperty({ enum: processingBudgetStatuses })
  processingBudgetStatus!: ProcessingBudgetStatusCode;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  processingLimitReachedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  openedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiProperty({
    description:
      'Momento em que a retenção obrigatória foi posta. Nulo quando o caso não está retido.',
    nullable: true,
  })
  legalHoldAt!: string | null;

  @ApiProperty({
    description: 'Motivo registrado da retenção obrigatória.',
    nullable: true,
  })
  legalHoldReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CaseListResponseDto {
  @ApiProperty({ type: [CaseResponseDto] })
  data!: CaseResponseDto[];

  @ApiProperty({ example: { nextCursor: 'opaque-cursor', hasNextPage: true } })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
