import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PersonIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Informe uma pessoa válida.' })
  id!: string;
}
