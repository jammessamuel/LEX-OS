import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DocumentIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe um documento válido.' })
  id!: string;
}
