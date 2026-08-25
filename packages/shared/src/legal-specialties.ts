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
    caseTypes: [
      {
        code: 'RECLAMACAO_TRABALHISTA_RITO_ORDINARIO',
        name: 'Reclamação trabalhista pelo rito ordinário',
      },
      {
        code: 'RECLAMACAO_TRABALHISTA_RITO_SUMARISSIMO',
        name: 'Reclamação trabalhista pelo rito sumaríssimo',
      },
      {
        code: 'VERBAS_RESCISORIAS_NAO_PAGAS',
        name: 'Verbas rescisórias não pagas ou pagas a menor',
      },
      { code: 'HORAS_EXTRAS_E_SOBREJORNADA', name: 'Horas extras e sobrejornada' },
      { code: 'ADICIONAL_INSALUBRIDADE', name: 'Adicional de insalubridade' },
      { code: 'ADICIONAL_PERICULOSIDADE', name: 'Adicional de periculosidade' },
      { code: 'ADICIONAL_NOTURNO', name: 'Adicional noturno' },
      { code: 'EQUIPARACAO_SALARIAL', name: 'Equiparação salarial (art. 461 da CLT)' },
      { code: 'DESVIO_E_ACUMULO_DE_FUNCAO', name: 'Desvio e acúmulo de função' },
      {
        code: 'RECONHECIMENTO_DE_VINCULO_EMPREGATICIO',
        name: 'Reconhecimento de vínculo empregatício',
      },
      {
        code: 'RESCISAO_INDIRETA',
        name: 'Rescisão indireta do contrato de trabalho (art. 483 da CLT)',
      },
      {
        code: 'REVERSAO_JUSTA_CAUSA',
        name: 'Reversão de justa causa (descaracterização da dispensa motivada)',
      },
      {
        code: 'ESTABILIDADE_GESTANTE',
        name: 'Estabilidade provisória da gestante (art. 10, II, "b", do ADCT)',
      },
      { code: 'ESTABILIDADE_ACIDENTARIA_E_CIPEIRO', name: 'Estabilidade acidentária e do cipeiro' },
      { code: 'ASSEDIO_MORAL_TRABALHO', name: 'Assédio moral no trabalho' },
      { code: 'ASSEDIO_SEXUAL_NO_TRABALHO', name: 'Assédio sexual no trabalho' },
      {
        code: 'DANOS_MORAIS_RELACAO_DE_EMPREGO',
        name: 'Danos morais decorrentes da relação de emprego (dano extrapatrimonial)',
      },
      {
        code: 'ACIDENTE_TRABALHO_DOENCA_OCUPACIONAL',
        name: 'Acidente de trabalho e doença ocupacional',
      },
      { code: 'FGTS_NAO_DEPOSITADO', name: 'FGTS não depositado ou recolhido a menor' },
      {
        code: 'TERCEIRIZACAO_RESPONSABILIDADE_SUBSIDIARIA',
        name: 'Terceirização e responsabilidade subsidiária',
      },
      {
        code: 'GRUPO_ECONOMICO_E_SUCESSAO_DE_EMPREGADORES',
        name: 'Grupo econômico e sucessão de empregadores',
      },
      {
        code: 'SUPRESSAO_INTERVALO_INTRAJORNADA',
        name: 'Supressão ou concessão parcial do intervalo intrajornada',
      },
      {
        code: 'BANCO_DE_HORAS_E_REGIME_DE_COMPENSACAO',
        name: 'Banco de horas e regime de compensação de jornada',
      },
      { code: 'CONTRATO_TRABALHO_INTERMITENTE', name: 'Contrato de trabalho intermitente' },
      { code: 'TELETRABALHO_CONTROLE_DE_JORNADA', name: 'Teletrabalho e controle de jornada' },
      { code: 'MOTORISTA_JORNADA_EXTERNA', name: 'Motorista e jornada externa' },
      { code: 'DISPENSA_COLETIVA', name: 'Dispensa coletiva (dispensa em massa)' },
      { code: 'ACAO_CUMPRIMENTO_NORMA_COLETIVA', name: 'Ação de cumprimento de norma coletiva' },
      { code: 'EXECUCAO_TRABALHISTA', name: 'Execução trabalhista' },
      { code: 'TUTELA_URGENCIA_TRABALHISTA', name: 'Tutela de urgência na Justiça do Trabalho' },
    ],
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
