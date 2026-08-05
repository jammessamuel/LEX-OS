import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateDocumentRequestDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'Informe um título válido.' })
  @MinLength(1, { message: 'Informe um título válido.' })
  @MaxLength(255, { message: 'O título excede o limite permitido.' })
  title?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 20_000 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe uma descrição válida.' })
  @MaxLength(20_000, { message: 'A descrição excede o limite permitido.' })
  description?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'Informe uma data documental válida.' },
  )
  documentDate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um emissor válido.' })
  @MaxLength(255, { message: 'O emissor excede o limite permitido.' })
  issuer?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString({ message: 'Informe um destinatário válido.' })
  @MaxLength(255, { message: 'O destinatário excede o limite permitido.' })
  recipient?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'Informe um tipo documental válido.' })
  documentTypeId?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'Informe se o documento é original.' })
  isOriginal?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'Informe se o documento está assinado.' })
  isSigned?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'Informe se o documento está legível.' })
  isLegible?: boolean | null;
}
