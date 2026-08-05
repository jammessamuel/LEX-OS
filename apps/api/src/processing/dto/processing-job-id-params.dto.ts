import { IsUUID } from 'class-validator';

export class ProcessingJobIdParamsDto {
  @IsUUID('4', { message: 'Informe um processamento válido.' })
  id!: string;
}
