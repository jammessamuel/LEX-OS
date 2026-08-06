import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChecklistTemplateItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  documentTypeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  documentTypeCode!: string | null;
}

export class ChecklistTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  legalArea!: string;

  @ApiProperty()
  caseType!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: [ChecklistTemplateItemResponseDto] })
  items!: ChecklistTemplateItemResponseDto[];
}

export class CaseChecklistItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseChecklistId!: string;

  @ApiProperty({ format: 'uuid' })
  templateItemId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  documentId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  validatedById!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  validatedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CaseChecklistResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty({ format: 'uuid' })
  templateId!: string;

  @ApiProperty()
  templateVersion!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [CaseChecklistItemResponseDto] })
  items!: CaseChecklistItemResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
