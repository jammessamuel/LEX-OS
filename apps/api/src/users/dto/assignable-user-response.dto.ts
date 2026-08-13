import { ApiProperty } from '@nestjs/swagger';

export class AssignableUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Advogada Fictícia' })
  name!: string;
}

export class AssignableUserListResponseDto {
  @ApiProperty({ type: [AssignableUserResponseDto] })
  data!: AssignableUserResponseDto[];

  @ApiProperty({ example: { nextCursor: 'opaque-cursor', hasNextPage: true } })
  pageInfo!: { nextCursor: string | null; hasNextPage: boolean };
}
