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
    caseTypes: [
      { code: 'INDENIZACAO_DANOS_MORAIS', name: 'Indenização por danos morais' },
      { code: 'REVISIONAL_CONTRATO_BANCARIO', name: 'Ação revisional de contrato bancário' },
      { code: 'ADJUDICACAO_COMPULSORIA', name: 'Adjudicação compulsória de imóvel' },
      { code: 'RESCISAO_CONTRATUAL', name: 'Rescisão contratual' },
      { code: 'USUCAPIAO', name: 'Usucapião' },
      {
        code: 'BUSCA_E_APREENSAO_ALIENACAO_FIDUCIARIA',
        name: 'Busca e apreensão em alienação fiduciária',
      },
      {
        code: 'DESPEJO_POR_FALTA_DE_PAGAMENTO',
        name: 'Despejo por falta de pagamento de aluguel e encargos',
      },
      { code: 'EXECUCAO_DE_TITULO_EXTRAJUDICIAL', name: 'Execução de título extrajudicial' },
      { code: 'DIVORCIO', name: 'Divórcio' },
      { code: 'ACAO_DE_COBRANCA', name: 'Ação de cobrança' },
      { code: 'ACAO_MONITORIA', name: 'Ação monitória' },
      { code: 'INDENIZACAO_POR_DANOS_MATERIAIS', name: 'Indenização por danos materiais' },
      { code: 'GUARDA_E_REGIME_DE_CONVIVENCIA', name: 'Guarda e regime de convivência' },
      { code: 'ACAO_REIVINDICATORIA', name: 'Ação reivindicatória' },
      { code: 'ACAO_RENOVATORIA_DE_LOCACAO', name: 'Ação renovatória de locação não residencial' },
      { code: 'INVENTARIO_E_PARTILHA', name: 'Inventário e partilha' },
      { code: 'VICIO_OU_FATO_DO_PRODUTO', name: 'Vício ou fato do produto' },
      {
        code: 'RECONHECIMENTO_E_DISSOLUCAO_DE_UNIAO_ESTAVEL',
        name: 'Reconhecimento e dissolução de união estável',
      },
      { code: 'ACAO_DE_ALIMENTOS', name: 'Ação de alimentos' },
      { code: 'INTERDICAO_E_CURATELA', name: 'Interdição e curatela' },
      {
        code: 'COBRANCA_INDEVIDA_E_NEGATIVACAO',
        name: 'Cobrança indevida e inscrição em cadastro de inadimplentes',
      },
      { code: 'EMBARGOS_DE_TERCEIRO', name: 'Embargos de terceiro' },
      { code: 'INVESTIGACAO_DE_PATERNIDADE', name: 'Investigação de paternidade' },
      { code: 'OBRIGACAO_DE_FAZER', name: 'Ação de obrigação de fazer' },
      {
        code: 'PLANO_SAUDE_NEGATIVA_DE_COBERTURA',
        name: 'Negativa de cobertura por plano de saúde',
      },
      {
        code: 'DECLARATORIA_INEXISTENCIA_DEBITO',
        name: 'Ação declaratória de inexistência de débito (inexigibilidade)',
      },
      { code: 'CUMPRIMENTO_DE_SENTENCA', name: 'Cumprimento de sentença' },
      { code: 'TUTELA_DE_URGENCIA', name: 'Tutela de urgência no processo civil' },
      {
        code: 'RESPONSABILIDADE_CIVIL_ACIDENTE_DE_TRANSITO',
        name: 'Responsabilidade civil por acidente de trânsito',
      },
      { code: 'ANULATORIA_NEGOCIO_JURIDICO', name: 'Ação anulatória de negócio jurídico' },
    ],
  },
  {
    code: 'CRIMINAL',
    name: 'Direito penal',
    aliases: ['PENAL', 'DIREITO_CRIMINAL', 'DIREITO_PENAL'],
    caseTypes: [
      {
        code: 'HOMICIDIO_TRIBUNAL_DO_JURI',
        name: 'Homicídio doloso e procedimento do tribunal do júri',
      },
      { code: 'ACAO_PENAL_PUBLICA_DENUNCIA', name: 'Ação penal pública e denúncia' },
      { code: 'PRISAO_PREVENTIVA', name: 'Prisão preventiva' },
      {
        code: 'POSSE_E_PORTE_ILEGAL_DE_ARMA_DE_FOGO',
        name: 'Posse e porte ilegal de arma de fogo',
      },
      { code: 'TRAFICO_DE_DROGAS', name: 'Tráfico de drogas' },
      { code: 'HABEAS_CORPUS', name: 'Habeas corpus (liberatório e preventivo)' },
      { code: 'INQUERITO_POLICIAL', name: 'Inquérito policial' },
      {
        code: 'PRISAO_EM_FLAGRANTE_E_AUDIENCIA_DE_CUSTODIA',
        name: 'Prisão em flagrante e audiência de custódia',
      },
      {
        code: 'LIBERDADE_PROVISORIA_E_RELAXAMENTO_DE_PRISAO',
        name: 'Liberdade provisória e relaxamento de prisão',
      },
      {
        code: 'VIOLENCIA_DOMESTICA_CONTRA_A_MULHER',
        name: 'Violência doméstica e familiar contra a mulher',
      },
      { code: 'ESTELIONATO', name: 'Estelionato (CP, art. 171)' },
      { code: 'ACAO_PENAL_PRIVADA_QUEIXA_CRIME', name: 'Ação penal privada e queixa-crime' },
      { code: 'ROUBO', name: 'Roubo' },
      { code: 'FURTO', name: 'Furto (art. 155 do Código Penal)' },
      { code: 'CRIMES_CONTRA_A_DIGNIDADE_SEXUAL', name: 'Crimes contra a dignidade sexual' },
      { code: 'CRIMES_CONTRA_ORDEM_TRIBUTARIA', name: 'Crimes contra a ordem tributária' },
      {
        code: 'SUSPENSAO_CONDICIONAL_DO_PROCESSO',
        name: 'Suspensão condicional do processo (sursis processual — art. 89 da Lei 9.099/1995)',
      },
      {
        code: 'TRANSACAO_PENAL_JECRIM',
        name: 'Transação penal no Juizado Especial Criminal (art. 76 da Lei 9.099/1995)',
      },
      { code: 'ACORDO_NAO_PERSECUCAO_PENAL', name: 'Acordo de não persecução penal (ANPP)' },
      { code: 'REVISAO_CRIMINAL', name: 'Revisão criminal' },
      {
        code: 'LAVAGEM_DE_DINHEIRO',
        name: 'Lavagem de dinheiro (ocultação de bens, direitos e valores — Lei 9.613/1998)',
      },
      { code: 'ORGANIZACAO_CRIMINOSA', name: 'Organização criminosa (art. 2º da Lei 12.850/2013)' },
      { code: 'LESAO_CORPORAL', name: 'Lesão corporal (art. 129 do Código Penal)' },
      { code: 'PROGRESSAO_DE_REGIME', name: 'Progressão de regime' },
      { code: 'CRIME_AMBIENTAL', name: 'Crimes ambientais (Lei 9.605/1998)' },
      {
        code: 'CRIMES_DE_TRANSITO',
        name: 'Crimes de trânsito (CTB — Lei 9.503/1997, arts. 302 a 312)',
      },
      {
        code: 'CRIMES_CONTRA_ADMINISTRACAO_PUBLICA',
        name: 'Crimes contra a Administração Pública',
      },
      {
        code: 'APELACAO_RECURSO_SENTIDO_ESTRITO',
        name: 'Recursos criminais: apelação e recurso em sentido estrito',
      },
      { code: 'CRIMES_CONTRA_HONRA', name: 'Crimes contra a honra (calúnia, difamação e injúria)' },
      { code: 'LIVRAMENTO_CONDICIONAL', name: 'Execução penal: livramento condicional' },
    ],
  },
  {
    code: 'PREVIDENCIARIO',
    name: 'Direito previdenciário',
    aliases: ['DIREITO_PREVIDENCIARIO', 'PREVIDENCIA', 'INSS'],
    caseTypes: [
      { code: 'APOSENTADORIA_POR_IDADE', name: 'Aposentadoria por idade' },
      {
        code: 'APOSENTADORIA_POR_TEMPO_DE_CONTRIBUICAO',
        name: 'Aposentadoria por tempo de contribuição',
      },
      {
        code: 'APOSENTADORIA_ESPECIAL',
        name: 'Aposentadoria especial por exposição a agente nocivo',
      },
      {
        code: 'APOSENTADORIA_POR_INCAPACIDADE_PERMANENTE',
        name: 'Aposentadoria por incapacidade permanente',
      },
      { code: 'AUXILIO_POR_INCAPACIDADE_TEMPORARIA', name: 'Auxílio por incapacidade temporária' },
      { code: 'AUXILIO_ACIDENTE', name: 'Auxílio-acidente' },
      {
        code: 'BENEFICIO_DE_PRESTACAO_CONTINUADA',
        name: 'Benefício de prestação continuada (BPC/LOAS)',
      },
      { code: 'PENSAO_POR_MORTE', name: 'Pensão por morte' },
      { code: 'SALARIO_MATERNIDADE', name: 'Salário-maternidade' },
      {
        code: 'APOSENTADORIA_RURAL_POR_IDADE',
        name: 'Aposentadoria rural por idade e segurado especial',
      },
      {
        code: 'AVERBACAO_E_RECONHECIMENTO_DE_TEMPO',
        name: 'Averbação e reconhecimento de tempo de contribuição',
      },
      { code: 'CONVERSAO_DE_TEMPO_ESPECIAL', name: 'Conversão de tempo especial em comum' },
      {
        code: 'REVISAO_DE_BENEFICIO',
        name: 'Revisão de renda mensal inicial e de benefício concedido',
      },
      {
        code: 'RESTABELECIMENTO_DE_BENEFICIO_CESSADO',
        name: 'Restabelecimento de benefício cessado',
      },
      {
        code: 'CONCESSAO_APOS_INDEFERIMENTO_ADMINISTRATIVO',
        name: 'Concessão após indeferimento administrativo',
      },
      {
        code: 'CERTIDAO_DE_TEMPO_DE_CONTRIBUICAO',
        name: 'Certidão de tempo de contribuição e contagem recíproca',
      },
      {
        code: 'DESAPOSENTACAO_E_REAFIRMACAO_DER',
        name: 'Reafirmação da DER e revisão do requerimento',
      },
      { code: 'BENEFICIO_ACIDENTARIO', name: 'Benefício acidentário e nexo técnico' },
    ],
  },
  {
    code: 'TRIBUTARIO',
    name: 'Direito tributário',
    aliases: ['DIREITO_TRIBUTARIO', 'FISCAL', 'TRIBUTOS'],
    caseTypes: [
      { code: 'EXECUCAO_FISCAL', name: 'Execução fiscal' },
      { code: 'EMBARGOS_A_EXECUCAO_FISCAL', name: 'Embargos à execução fiscal' },
      { code: 'EXCECAO_DE_PRE_EXECUTIVIDADE', name: 'Exceção de pré-executividade' },
      { code: 'ANULATORIA_DE_DEBITO_FISCAL', name: 'Ação anulatória de débito fiscal' },
      {
        code: 'DECLARATORIA_DE_INEXISTENCIA_DE_RELACAO_TRIBUTARIA',
        name: 'Ação declaratória de inexistência de relação jurídico-tributária',
      },
      { code: 'REPETICAO_DE_INDEBITO_TRIBUTARIO', name: 'Repetição de indébito tributário' },
      {
        code: 'MANDADO_DE_SEGURANCA_TRIBUTARIO',
        name: 'Mandado de segurança em matéria tributária',
      },
      {
        code: 'IMPUGNACAO_DE_AUTO_DE_INFRACAO',
        name: 'Impugnação de auto de infração no contencioso administrativo',
      },
      {
        code: 'RECURSO_ADMINISTRATIVO_FISCAL',
        name: 'Recurso no contencioso administrativo fiscal',
      },
      { code: 'PARCELAMENTO_E_EXCLUSAO', name: 'Parcelamento tributário e exclusão do programa' },
      {
        code: 'CERTIDAO_NEGATIVA_DE_DEBITOS',
        name: 'Obtenção de certidão negativa ou positiva com efeito de negativa',
      },
      { code: 'COMPENSACAO_TRIBUTARIA', name: 'Compensação tributária e sua homologação' },
      {
        code: 'REDIRECIONAMENTO_AO_SOCIO',
        name: 'Redirecionamento da execução ao sócio ou administrador',
      },
      {
        code: 'ISS_ICMS_CONFLITO_DE_COMPETENCIA',
        name: 'Conflito de competência entre ISS e ICMS',
      },
      { code: 'ITBI_E_ITCMD', name: 'ITBI e ITCMD: base de cálculo e lançamento' },
      { code: 'IPTU_E_TAXAS_MUNICIPAIS', name: 'IPTU e taxas municipais' },
      {
        code: 'CONTRIBUICOES_PREVIDENCIARIAS_PATRONAIS',
        name: 'Contribuições previdenciárias patronais e verbas de natureza indenizatória',
      },
      { code: 'PIS_COFINS_BASE_DE_CALCULO', name: 'PIS e COFINS: base de cálculo e créditos' },
      { code: 'IRPJ_CSLL_LUCRO', name: 'IRPJ e CSLL: apuração e glosa de despesas' },
      {
        code: 'PENHORA_E_GARANTIA_DO_JUIZO',
        name: 'Penhora, garantia do juízo e substituição da garantia',
      },
    ],
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
