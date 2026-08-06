import { describe, expect, it } from 'vitest';

import { caseStatuses, confidentialityLevels, priorities } from '../api/types';
import {
  caseStatusLabels,
  confidentialityLabels,
  documentSituation,
  formatBytes,
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

describe('situação do documento', () => {
  const base = {
    processingStatus: 'COMPLETED',
    classificationStatus: 'PENDING',
    isDuplicate: false,
  };

  it('resume os dois eixos da API numa frase só', () => {
    expect(documentSituation(base).label).toBe('Aguardando revisão');
    expect(documentSituation({ ...base, classificationStatus: 'CONFIRMED' }).label).toBe(
      'Revisado',
    );
    expect(documentSituation({ ...base, processingStatus: 'PROCESSING' }).label).toBe('Preparando');
    expect(documentSituation({ ...base, processingStatus: 'FAILED' }).tone).toBe('rejeitado');
  });

  it('duplicata vence qualquer outro estado', () => {
    expect(documentSituation({ ...base, isDuplicate: true }).label).toBe('Duplicado');
  });

  it('nunca devolve o código cru, mesmo para um estado desconhecido', () => {
    const desconhecido = documentSituation({ ...base, processingStatus: 'ALGO_NOVO' });
    expect(desconhecido.label).toBe('Em preparação');
    expect(desconhecido.label).not.toMatch(/[A-Z]{2,}|_/u);
  });
});

describe('formatBytes', () => {
  it('usa unidade legível e separador brasileiro', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(26_214_400)).toBe('25 MB');
  });
});
