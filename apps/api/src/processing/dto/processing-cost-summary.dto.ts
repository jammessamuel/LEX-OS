import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

/**
 * Recorte da consulta de custo (ADR-011, verificação 3).
 *
 * O período é obrigatório em espírito e opcional em forma: sem ele a consulta responde pelo mês
 * corrente, porque "quanto gastamos" sem período é pergunta que não tem resposta útil e a
 * varredura da tabela inteira não é de graça.
 */
export class ProcessingCostQueryDto {
  @ApiProperty({
    description: 'Início do período, inclusive. Padrão: primeiro dia do mês corrente.',
    required: false,
  })
  @IsOptional()
  @IsISO8601({}, { message: 'A data inicial deve estar no formato ISO 8601.' })
  from?: string;

  @ApiProperty({
    description: 'Fim do período, exclusive. Padrão: agora.',
    required: false,
  })
  @IsOptional()
  @IsISO8601({}, { message: 'A data final deve estar no formato ISO 8601.' })
  to?: string;

  @ApiProperty({
    description:
      'Como abrir o total: por provedor, por modelo, por tipo de trabalho ou por caso. ' +
      'O total da organização vem sempre, independentemente do recorte.',
    enum: ['provider', 'model', 'jobType', 'case'],
    required: false,
  })
  @IsOptional()
  @IsIn(['provider', 'model', 'jobType', 'case'], {
    message: 'O recorte deve ser provider, model, jobType ou case.',
  })
  groupBy?: 'provider' | 'model' | 'jobType' | 'case';
}

export class ProcessingCostBucketDto {
  @ApiProperty({ description: 'O valor do recorte. Nulo quando a etapa não registrou o campo.' })
  key!: string | null;

  @ApiProperty({ description: 'Rótulo legível do recorte, quando houver.' })
  label!: string | null;

  @ApiProperty({ description: 'Custo somado no período, com seis casas.' })
  amount!: string;

  @ApiProperty({ description: 'Quantidade de execuções somadas.' })
  executions!: number;
}

export class ProcessingCostSummaryDto {
  @ApiProperty({ description: 'Início do período considerado.' })
  from!: string;

  @ApiProperty({ description: 'Fim do período considerado.' })
  to!: string;

  @ApiProperty({ description: 'Moeda dos valores.' })
  currency!: string;

  @ApiProperty({
    description:
      'Custo total da organização no período. É este número que faltava: o teto do ADR-011 ' +
      'era por caso, e um escritório com trezentos casos ativos não tinha teto nenhum de fato.',
  })
  total!: string;

  @ApiProperty({ description: 'Execuções somadas no período.' })
  executions!: number;

  @ApiProperty({ description: 'Como o total foi aberto.' })
  groupBy!: 'provider' | 'model' | 'jobType' | 'case';

  @ApiProperty({ type: [ProcessingCostBucketDto] })
  buckets!: ProcessingCostBucketDto[];
}
