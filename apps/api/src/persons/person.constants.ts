export const personTypes = ['INDIVIDUAL', 'COMPANY', 'GOVERNMENT_ENTITY'] as const;

export type PersonTypeCode = (typeof personTypes)[number];
