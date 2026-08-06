import { IsIn, IsOptional } from 'class-validator';

import { CursorPaginationQueryDto } from '../../http/pagination.js';

const taskStatuses = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class ListTasksQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsIn(taskStatuses, { message: 'Informe um status de tarefa válido.' })
  status?: (typeof taskStatuses)[number];
}
