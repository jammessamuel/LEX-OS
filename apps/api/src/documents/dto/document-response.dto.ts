import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentFileSummaryDto {
  @ApiProperty({ example: 'documento-ficticio.pdf' })
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 1024 })
  sizeBytes!: number;

  @ApiProperty({ example: 'CLEAN' })
  virusScanStatus!: string;

  @ApiProperty({ example: 'AVAILABLE' })
  status!: string;
}

export class DocumentTypeSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CONTRATO' })
  code!: string;

  @ApiProperty({ example: 'Contrato' })
  name!: string;

  @ApiProperty({ example: 'CONTRATUAL' })
  category!: string;
}

export class DocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  caseId!: string | null;

  @ApiProperty({ format: 'uuid' })
  fileId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  documentTypeId!: string | null;

  @ApiProperty({ example: 'Documento fictício' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  documentDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  issuer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  recipient!: string | null;

  @ApiProperty({ example: 'PENDING' })
  classificationStatus!: string;

  @ApiProperty({ example: 'QUEUED' })
  processingStatus!: string;

  @ApiProperty()
  isOriginal!: boolean;

  @ApiPropertyOptional({ nullable: true })
  isSigned!: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  isLegible!: boolean | null;

  @ApiProperty()
  isDuplicate!: boolean;

  @ApiProperty({ type: DocumentFileSummaryDto })
  file!: DocumentFileSummaryDto;

  @ApiPropertyOptional({ type: DocumentTypeSummaryDto, nullable: true })
  documentType!: DocumentTypeSummaryDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class DocumentPageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  data!: DocumentResponseDto[];

  @ApiProperty({ type: DocumentPageInfoDto })
  pageInfo!: DocumentPageInfoDto;
}
