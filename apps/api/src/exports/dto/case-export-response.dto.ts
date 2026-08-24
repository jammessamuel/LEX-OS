import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CaseExportResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty({ enum: ['QUEUED', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ example: 1 })
  attempts!: number;

  /**
   * URL assinada, presente apenas quando o dossiê está pronto.
   *
   * Vive pouco e é gerada a cada consulta: guardá-la em qualquer lugar — trilha, log, banco —
   * transformaria o registro numa cópia da chave.
   */
  @ApiPropertyOptional({ nullable: true })
  downloadUrl!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  downloadExpiresAt!: string | null;

  @ApiPropertyOptional({ example: 184_320, nullable: true })
  byteSize!: number | null;

  @ApiPropertyOptional({ example: 'CASE_EXPORT_FAILED', nullable: true })
  errorCode!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finishedAt!: string | null;
}
