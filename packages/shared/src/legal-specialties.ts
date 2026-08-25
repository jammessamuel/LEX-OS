/**
 * Especialidades do direito reconhecidas pelo produto.
 *
 * `legalArea` é `VarChar(120)` livre no banco, validado só por formato, e já existe divergência
 * solta no repositório: o seed grava `TRABALHISTA` e os testes da interface usam
 * `DIREITO_TRABALHISTA`. Este catálogo **não fecha o campo** — casos já cadastrados usam valores
 * que uma lista fechada invalidaria, e travar isso agora quebraria dado real do demo.
 *
 * Ele resolve outra coisa: dar um identificador estável para pendurar comportamento por
 * especialidade. Hoje o único uso de `legalArea` é casar um checklist template por igualdade de
 * string; a partir daqui ele também escolhe qual prompt vai ao modelo, e para isso
 * `DIREITO_TRABALHISTA` e `TRABALHISTA` precisam chegar ao mesmo lugar.
 *
 * Área desconhecida não é erro. Devolve `null`, e quem chama cai no comportamento genérico —
 * um escritório de direito marítimo continua funcionando sem que ninguém tenha catalogado
 * direito marítimo.
 */

export interface LegalCaseType {
  code: string;
  name: string;
}

export interface LegalSpecialty {
  code: string;
  name: string;
  /** Grafias que o produto já viu para esta mesma área, todas resolvidas para `code`. */
  aliases: readonly string[];
  /**
   * Tipos de caso conhecidos desta especialidade.
   *
   * Começa apenas com o que existe de fato no repositório. A pesquisa por especialidade é que
   * preenche o resto — inventar uma taxonomia aqui, sem levantamento, seria exatamente o
   * palpite que a pesquisa existe para evitar.
   */
  caseTypes: readonly LegalCaseType[];
}

export const legalSpecialties: readonly LegalSpecialty[] = [
  {
    code: 'TRABALHISTA',
    name: 'Direito do trabalho',
    aliases: ['DIREITO_TRABALHISTA', 'DIREITO_DO_TRABALHO', 'TRABALHO'],
    caseTypes: [{ code: 'RECLAMACAO_TRABALHISTA', name: 'Reclamação trabalhista' }],
  },
  {
    code: 'CIVEL',
    name: 'Direito civil',
    aliases: ['CIVIL', 'DIREITO_CIVEL', 'DIREITO_CIVIL'],
    caseTypes: [{ code: 'ACAO_DE_COBRANCA', name: 'Ação de cobrança' }],
  },
  {
    code: 'CRIMINAL',
    name: 'Direito penal',
    aliases: ['PENAL', 'DIREITO_CRIMINAL', 'DIREITO_PENAL'],
    caseTypes: [],
  },
];

const byCode = new Map<string, LegalSpecialty>();
for (const specialty of legalSpecialties) {
  byCode.set(specialty.code, specialty);
  for (const alias of specialty.aliases) {
    byCode.set(alias, specialty);
  }
}

/** Normaliza a grafia antes de procurar: o campo aceita minúscula e o transform da API sobe. */
export function specialtyFor(legalArea: string | null | undefined): LegalSpecialty | null {
  if (typeof legalArea !== 'string') {
    return null;
  }
  return byCode.get(legalArea.trim().toUpperCase()) ?? null;
}

/** Código canônico da área, ou `null` quando ela não está catalogada. */
export function specialtyCodeFor(legalArea: string | null | undefined): string | null {
  return specialtyFor(legalArea)?.code ?? null;
}
