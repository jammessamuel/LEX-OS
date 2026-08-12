import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export const searchModes = ['HYBRID', 'LEXICAL', 'SEMANTIC'] as const;
export type SearchMode = (typeof searchModes)[number];

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SearchRequestDto {
  @ApiProperty({ example: 'contrato celebrado em agosto de 2026', minLength: 2, maxLength: 500 })
  @Transform(({ value }) => trimmed(value))
  @IsString({ message: 'Informe um texto de pesquisa válido.' })
  @MinLength(2, { message: 'A pesquisa deve ter pelo menos 2 caracteres.' })
  @MaxLength(500, { message: 'A pesquisa excede o limite permitido.' })
  query!: string;

  @ApiPropertyOptional({ enum: searchModes, default: 'HYBRID' })
  @IsOptional()
  @IsIn(searchModes, { message: 'Informe um modo de pesquisa válido.' })
  mode?: SearchMode;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um caso válido.' })
  caseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um documento válido.' })
  documentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um tipo documental válido.' })
  documentTypeId?: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'TRABALHISTA' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLocaleUpperCase('pt-BR') : value,
  )
  @IsOptional()
  @IsString({ message: 'Informe uma área jurídica válida.' })
  @MinLength(1, { message: 'Informe uma área jurídica válida.' })
  @MaxLength(120, { message: 'A área jurídica excede o limite permitido.' })
  legalArea?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 25, default: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser pelo menos 1.' })
  @Max(25, { message: 'O limite não pode exceder 25.' })
  limit = 10;
}
