import { IsUUID } from 'class-validator';

export class ApplyChecklistRequestDto {
  @IsUUID('4', { message: 'O template deve ser um UUID válido.' })
  templateId!: string;
}
