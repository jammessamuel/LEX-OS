import { ApiProperty } from '@nestjs/swagger';

export class CurrentOrganizationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lex OS Escritório Jurídico Fictício Ltda.' })
  legalName!: string;

  @ApiProperty({ example: 'Lex OS Demonstração' })
  tradeName!: string;

  @ApiProperty({ example: 'DEMO' })
  subscriptionPlan!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: 'ACTIVE';
}
