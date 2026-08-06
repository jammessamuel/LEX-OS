import { IsUUID } from 'class-validator';

export class TimelineEventIdParamsDto {
  @IsUUID('4', { message: 'O identificador do evento deve ser um UUID válido.' })
  id!: string;
}
