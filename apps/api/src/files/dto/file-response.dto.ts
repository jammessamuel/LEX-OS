import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  documentId!: string;

  @ApiProperty({ example: 'documento-ficticio.pdf' })
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 'pdf' })
  extension!: string;

  @ApiProperty({ example: 1024 })
  sizeBytes!: number;

  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'CLEAN', 'INFECTED', 'ERROR'] })
  virusScanStatus!: string;

  @ApiProperty({ enum: ['QUARANTINED', 'VALIDATING', 'AVAILABLE', 'REJECTED', 'FAILED'] })
  status!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  duplicateOfFileId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class FilePageInfoDto {
  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;
}

export class FileListResponseDto {
  @ApiProperty({ type: [FileResponseDto] })
  data!: FileResponseDto[];

  @ApiProperty({ type: FilePageInfoDto })
  pageInfo!: FilePageInfoDto;
}

export class IntakeJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['FILE_VALIDATION', 'VIRUS_SCAN'] })
  jobType!: string;

  @ApiProperty({ example: 'QUEUED' })
  status!: string;
}

export class AcceptedFileIntakeResponseDto {
  @ApiProperty({ type: FileResponseDto })
  file!: FileResponseDto;

  @ApiProperty({ type: IntakeJobResponseDto })
  job!: IntakeJobResponseDto;
}

export class RejectedFileIntakeResponseDto {
  @ApiProperty({ minimum: 0 })
  fileIndex!: number;

  @ApiProperty({ example: 'FILE_MIME_MISMATCH' })
  code!: string;

  @ApiProperty({ example: 'O conteúdo do arquivo não corresponde ao tipo informado.' })
  message!: string;
}

export class FileIntakeBatchResponseDto {
  @ApiProperty({ type: [AcceptedFileIntakeResponseDto] })
  accepted!: AcceptedFileIntakeResponseDto[];

  @ApiProperty({ type: [RejectedFileIntakeResponseDto] })
  rejected!: RejectedFileIntakeResponseDto[];
}

export class DownloadUrlResponseDto {
  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
