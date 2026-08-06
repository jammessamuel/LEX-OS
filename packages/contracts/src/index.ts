export const processingQueueNames = {
  CHECKLIST_ANALYSIS: 'checklist-analysis',
  DOCUMENT_CLASSIFICATION: 'document-classification',
  ENTITY_EXTRACTION: 'entity-extraction',
  FILE_VALIDATION: 'file-validation',
  OCR: 'ocr-processing',
  TIMELINE_GENERATION: 'timeline-generation',
  VIRUS_SCAN: 'virus-scan',
} as const;

export type ProcessingJobType = keyof typeof processingQueueNames;
export type ProcessingQueueName = (typeof processingQueueNames)[ProcessingJobType];

export interface ProcessingJobMessageV1 {
  schemaVersion: 1;
  processingJobId: string;
  organizationId: string;
  correlationId: string;
}

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const safeIdentifierPattern = /^[a-zA-Z0-9._:-]{1,128}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isProcessingJobType(value: string): value is ProcessingJobType {
  return Object.hasOwn(processingQueueNames, value);
}

export function queueNameForJobType(jobType: ProcessingJobType): ProcessingQueueName {
  return processingQueueNames[jobType];
}

export function parseProcessingJobMessage(value: unknown): ProcessingJobMessageV1 {
  if (!isRecord(value)) {
    throw new Error('Processing message must be an object.');
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = ['correlationId', 'organizationId', 'processingJobId', 'schemaVersion'];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error('Processing message contains unexpected fields.');
  }
  if (value.schemaVersion !== 1) {
    throw new Error('Unsupported processing message schema version.');
  }
  if (typeof value.processingJobId !== 'string' || !uuidV4Pattern.test(value.processingJobId)) {
    throw new Error('Processing message has an invalid job ID.');
  }
  if (typeof value.organizationId !== 'string' || !uuidV4Pattern.test(value.organizationId)) {
    throw new Error('Processing message has an invalid organization ID.');
  }
  if (typeof value.correlationId !== 'string' || !safeIdentifierPattern.test(value.correlationId)) {
    throw new Error('Processing message has an invalid correlation ID.');
  }

  return {
    schemaVersion: 1,
    processingJobId: value.processingJobId,
    organizationId: value.organizationId,
    correlationId: value.correlationId,
  };
}

export function createProcessingJobMessage(input: {
  processingJobId: string;
  organizationId: string;
  correlationId: string;
}): ProcessingJobMessageV1 {
  return parseProcessingJobMessage({ schemaVersion: 1, ...input });
}
