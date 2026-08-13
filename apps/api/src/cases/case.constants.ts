export const caseStatuses = [
  'INTAKE',
  'DOCUMENT_COLLECTION',
  'UNDER_ANALYSIS',
  'READY_TO_FILE',
  'FILED',
  'ACTIVE',
  'SUSPENDED',
  'SETTLED',
  'CLOSED',
  'ARCHIVED',
] as const;

export const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const confidentialityLevels = ['STANDARD', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export const processingBudgetStatuses = ['ACTIVE', 'LIMIT_REACHED'] as const;

export type CaseStatusCode = (typeof caseStatuses)[number];
export type PriorityCode = (typeof priorities)[number];
export type ConfidentialityLevelCode = (typeof confidentialityLevels)[number];
export type ProcessingBudgetStatusCode = (typeof processingBudgetStatuses)[number];
