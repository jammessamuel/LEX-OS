import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { searchModes, type SearchMode } from '../../search/dto/search-request.dto.js';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class GroundedAnswerRequestDto {
  @ApiProperty({ minLength: 2, maxLength: 500, example: 'Qual data consta no contrato?' })
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: 'Informe uma pergunta válida.' })
  @MinLength(2, { message: 'A pergunta deve ter pelo menos 2 caracteres.' })
  @MaxLength(500, { message: 'A pergunta excede o limite permitido.' })
  question!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um caso válido.' })
  caseId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um documento válido.' })
  documentId?: string;

  @ApiPropertyOptional({ enum: searchModes, default: 'HYBRID' })
  @IsOptional()
  @IsIn(searchModes, { message: 'Informe um modo de recuperação válido.' })
  mode?: SearchMode;

  /**
   * Quantos trechos sustentam a resposta. É teto e padrão ao mesmo tempo, e mora só aqui.
   *
   * Oito, pelo ADR-017 de 2026-09-06, que reabriu o teto de cinco do ADR-016 com a avaliação
   * medida que aquele registro exigia como condição. De seis perguntas cujas respostas estão
   * comprovadamente no acervo, três trechos alcançavam três, cinco alcançam cinco, e a sexta —
   * a data de pagamento das verbas rescisórias, que está literalmente no TRCT — cai na posição
   * seis do ranking. Com teto cinco o modelo nunca via o trecho: não é falha de leitura, é o
   * sistema não entregando o documento que ele mesmo indexou.
   *
   * Custa R$ 0,0793 a mais por resposta. Num produto jurídico o fato que falta é o erro que
   * importa, e silêncio sobre um documento que está no acervo parece ausência de prova.
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 8, default: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser pelo menos 1.' })
  @Max(8, { message: 'O limite não pode exceder 8.' })
  limit = 8;
}
