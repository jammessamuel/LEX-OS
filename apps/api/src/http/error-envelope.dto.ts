import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDetailDto {
  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'isEmail' })
  code!: string;

  @ApiProperty({ example: 'Informe um e-mail válido.' })
  message!: string;
}

export class ApiErrorEnvelopeDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Dados inválidos.' })
  message!: string;

  @ApiProperty({ type: [ApiErrorDetailDto] })
  details!: ApiErrorDetailDto[];

  @ApiProperty({ example: '018f2c2e-7c2f-7c62-b8b9-0eaf12b34123' })
  requestId!: string;
}
