import { IsUUID } from 'class-validator';

export class ChecklistItemIdParamsDto {
  @IsUUID('4', { message: 'O identificador do item deve ser um UUID válido.' })
  id!: string;
}
