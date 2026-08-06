import { describe, expect, it } from 'vitest';

import { caseStatuses, confidentialityLevels, priorities } from '../api/types';
import {
  caseStatusLabels,
  confidentialityLabels,
  humanizeCode,
  priorityLabels,
} from '../domain/vocabulary';

describe('vocabulário da interface', () => {
  it('traduz todo código da API, sem deixar rótulo técnico vazar', () => {
    for (const status of caseStatuses) {
      expect(caseStatusLabels[status], status).toBeTruthy();
      expect(caseStatusLabels[status]).not.toMatch(/[A-Z]{2,}|_/u);
    }
    for (const priority of priorities) {
      expect(priorityLabels[priority], priority).toBeTruthy();
      expect(priorityLabels[priority]).not.toMatch(/[A-Z]{2,}|_/u);
    }
    for (const level of confidentialityLevels) {
      expect(confidentialityLabels[level], level).toBeTruthy();
      expect(confidentialityLabels[level]).not.toMatch(/[A-Z]{2,}|_/u);
    }
  });

  it('normaliza códigos livres que não têm catálogo fechado', () => {
    expect(humanizeCode('RECLAMACAO_TRABALHISTA')).toBe('Reclamacao trabalhista');
    expect(humanizeCode('DIREITO_TRABALHISTA')).toBe('Direito trabalhista');
  });
});
