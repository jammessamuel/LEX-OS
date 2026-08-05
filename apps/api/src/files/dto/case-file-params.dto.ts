import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CaseFileParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um caso válido.' })
  caseId!: string;
}
