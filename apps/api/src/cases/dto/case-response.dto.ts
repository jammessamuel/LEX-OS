import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  caseStatuses,
  confidentialityLevels,
  priorities,
  type CaseStatusCode,
  type ConfidentialityLevelCode,
  type PriorityCode,
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

  @ApiProperty({ format: 'date-time' })
  openedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  closedAt!: string | null;

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
