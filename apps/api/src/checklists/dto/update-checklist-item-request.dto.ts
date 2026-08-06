import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

const checklistStatuses = [
  'MISSING',
  'RECEIVED',
  'INVALID',
  'EXPIRED',
  'ILLEGIBLE',
  'AWAITING_VALIDATION',
  'VALIDATED',
  'NOT_APPLICABLE',
] as const;

export class UpdateChecklistItemRequestDto {
  @IsOptional()
  @IsIn(checklistStatuses, { message: 'Informe um status de checklist válido.' })
  status?: (typeof checklistStatuses)[number];

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4', { message: 'O documento deve ser um UUID válido.' })
  documentId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'As observações devem ser texto.' })
  @MaxLength(2000, { message: 'As observações excedem o limite permitido.' })
  notes?: string | null;
}
