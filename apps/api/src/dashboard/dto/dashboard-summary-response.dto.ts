import { ApiProperty } from '@nestjs/swagger';

export class DashboardCaseSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  open!: number;

  @ApiProperty()
  highPriority!: number;

  @ApiProperty()
  processingLimitReached!: number;
}

export class DashboardDocumentSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  needsReview!: number;

  @ApiProperty()
  failed!: number;
}

export class DashboardTaskSummaryDto {
  @ApiProperty()
  open!: number;

  @ApiProperty()
  overdue!: number;
}

export class DashboardProcessingSummaryDto {
  @ApiProperty()
  active!: number;

  @ApiProperty()
  failed!: number;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ type: DashboardCaseSummaryDto })
  cases!: DashboardCaseSummaryDto;

  @ApiProperty({ type: DashboardDocumentSummaryDto })
  documents!: DashboardDocumentSummaryDto;

  @ApiProperty({ type: DashboardTaskSummaryDto })
  tasks!: DashboardTaskSummaryDto;

  @ApiProperty({ type: DashboardProcessingSummaryDto })
  processing!: DashboardProcessingSummaryDto;

  @ApiProperty({ format: 'date-time' })
  asOf!: string;
}
