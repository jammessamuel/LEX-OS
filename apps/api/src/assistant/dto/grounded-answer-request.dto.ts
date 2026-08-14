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

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 3 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser pelo menos 1.' })
  @Max(5, { message: 'O limite não pode exceder 5.' })
  limit = 3;
}
