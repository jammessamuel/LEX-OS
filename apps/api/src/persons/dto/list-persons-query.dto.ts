import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';
import { personTypes, type PersonTypeCode } from '../person.constants.js';

export class ListPersonsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ enum: personTypes })
  @IsOptional()
  @IsIn(personTypes, { message: 'Informe um tipo de pessoa válido.' })
  personType?: PersonTypeCode;
}
