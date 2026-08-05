import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { personTypes, type PersonTypeCode } from '../person.constants.js';

export class PersonResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: personTypes })
  personType!: PersonTypeCode;

  @ApiProperty({ example: 'Pessoa Fictícia de Teste' })
  fullName!: string;

  @ApiPropertyOptional({ nullable: true })
  tradeName!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '***.***.***-35' })
  cpf!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '**.***.***/****-81' })
  cnpj!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '****1234' })
  rg!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  birthDate!: string | null;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  occupation!: string | null;

  @ApiPropertyOptional({ nullable: true })
  maritalStatus!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PersonListResponseDto {
  @ApiProperty({ type: [PersonResponseDto] })
  data!: PersonResponseDto[];

  @ApiProperty({
    example: { nextCursor: 'opaque-cursor', hasNextPage: true },
  })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
