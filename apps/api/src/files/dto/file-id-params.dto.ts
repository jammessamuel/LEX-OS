import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class FileIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um arquivo válido.' })
  id!: string;
}
