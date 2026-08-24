import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CaseExportIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um identificador válido.' })
  id!: string;
}
