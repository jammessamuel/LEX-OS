import { IsUUID } from 'class-validator';

export class ExtractedEntityIdParamsDto {
  @IsUUID('4', { message: 'O identificador da entidade deve ser um UUID válido.' })
  id!: string;
}
