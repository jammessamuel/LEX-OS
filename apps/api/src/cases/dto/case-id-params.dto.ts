import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CaseIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um caso válido.' })
  id!: string;
}

export class NestedCaseIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um caso válido.' })
  caseId!: string;
}
