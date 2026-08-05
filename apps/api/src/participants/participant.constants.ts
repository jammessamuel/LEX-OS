export const participantRoles = [
  'autor',
  'reu',
  'reclamante',
  'reclamado',
  'testemunha',
  'perito',
  'juiz',
  'advogado',
  'terceiro_interessado',
  'representante_legal',
] as const;

export const participantSides = ['polo_ativo', 'polo_passivo', 'terceiro', 'neutro'] as const;

export type ParticipantRoleCode = (typeof participantRoles)[number];
export type ParticipantSideCode = (typeof participantSides)[number];

export function toDatabaseParticipantSide(side: ParticipantSideCode | null | undefined) {
  return side?.toUpperCase() as Uppercase<ParticipantSideCode> | undefined;
}
