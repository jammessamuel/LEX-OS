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
      { code: 'ACAO_DE_COBRANCA', name: 'Ação de cobrança' },
      { code: 'ACAO_MONITORIA', name: 'Ação monitória' },
      { code: 'INDENIZACAO_POR_DANOS_MATERIAIS', name: 'Indenização por danos materiais' },
      { code: 'ACAO_REIVINDICATORIA', name: 'Ação reivindicatória' },
      { code: 'ACAO_RENOVATORIA_DE_LOCACAO', name: 'Ação renovatória de locação não residencial' },
      { code: 'EMBARGOS_DE_TERCEIRO', name: 'Embargos de terceiro' },
      { code: 'OBRIGACAO_DE_FAZER', name: 'Ação de obrigação de fazer' },
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
  {
    /**
     * Família e sucessões saem de dentro do cível.
     *
     * Sete tipos desta faixa estavam catalogados como cíveis — divórcio, guarda, alimentos, união
     * estável, inventário, investigação de paternidade e curatela. Não é erro de arrumação: um
     * divórcio com partilha tem estrutura de disputa patrimonial, e por isso enganava. O que o
     * cível não tem é o resto — criança cujo interesse prevalece sobre o dos pais, prestação que
     * se mede pelo que um pode e o outro precisa, regime de bens que decide o que sequer entra na
     * partilha, herdeiro que não pode ser excluído, e processo que corre em segredo de justiça.
     *
     * Mover o tipo de caso não muda que prompt roda: quem escolhe é `legalArea`. Muda o que este
     * catálogo afirma, e afirmar que divórcio é matéria cível depois de existir uma faixa de
     * família é o catálogo dizendo duas coisas.
     */
    code: 'FAMILIA',
    name: 'Direito de família e sucessões',
    aliases: [
      'DIREITO_DE_FAMILIA',
      'FAMILIA_E_SUCESSOES',
      'DIREITO_DAS_FAMILIAS',
      'SUCESSOES',
      'DIREITO_SUCESSORIO',
    ],
    caseTypes: [
      { code: 'DIVORCIO_CONSENSUAL', name: 'Divórcio consensual' },
      { code: 'DIVORCIO_LITIGIOSO', name: 'Divórcio litigioso' },
      { code: 'PARTILHA_DE_BENS', name: 'Partilha de bens do casal' },
      {
        code: 'RECONHECIMENTO_E_DISSOLUCAO_DE_UNIAO_ESTAVEL',
        name: 'Reconhecimento e dissolução de união estável',
      },
      { code: 'ALIMENTOS_FIXACAO', name: 'Ação de alimentos' },
      { code: 'ALIMENTOS_REVISIONAL', name: 'Revisional de alimentos' },
      { code: 'ALIMENTOS_EXONERACAO', name: 'Exoneração de alimentos' },
      { code: 'ALIMENTOS_EXECUCAO', name: 'Execução de alimentos' },
      { code: 'ALIMENTOS_GRAVIDICOS', name: 'Alimentos gravídicos' },
      { code: 'GUARDA_E_CONVIVENCIA', name: 'Guarda e regime de convivência' },
      { code: 'ALTERACAO_DE_GUARDA', name: 'Modificação de guarda' },
      { code: 'ALIENACAO_PARENTAL', name: 'Alegação de alienação parental' },
      { code: 'AUTORIZACAO_DE_VIAGEM_DE_MENOR', name: 'Autorização judicial de viagem de menor' },
      { code: 'INVESTIGACAO_DE_PATERNIDADE', name: 'Investigação de paternidade' },
      { code: 'NEGATORIA_DE_PATERNIDADE', name: 'Negatória de paternidade' },
      {
        code: 'RECONHECIMENTO_DE_PATERNIDADE_SOCIOAFETIVA',
        name: 'Reconhecimento de paternidade socioafetiva',
      },
      { code: 'ADOCAO', name: 'Adoção' },
      { code: 'DESTITUICAO_DO_PODER_FAMILIAR', name: 'Destituição do poder familiar' },
      { code: 'CURATELA', name: 'Curatela e tomada de decisão apoiada' },
      { code: 'MEDIDA_PROTETIVA_VIOLENCIA_DOMESTICA', name: 'Medida protetiva de urgência' },
      { code: 'INVENTARIO_JUDICIAL', name: 'Inventário judicial' },
      { code: 'INVENTARIO_EXTRAJUDICIAL', name: 'Inventário extrajudicial' },
      { code: 'ARROLAMENTO', name: 'Arrolamento sumário e comum' },
      { code: 'SOBREPARTILHA', name: 'Sobrepartilha de bem não inventariado' },
      {
        code: 'TESTAMENTO_ABERTURA_E_REGISTRO',
        name: 'Abertura, registro e cumprimento de testamento',
      },
      { code: 'ANULACAO_DE_TESTAMENTO', name: 'Anulação de testamento' },
      { code: 'PETICAO_DE_HERANCA', name: 'Petição de herança' },
      { code: 'ALVARA_JUDICIAL_SUCESSORIO', name: 'Alvará judicial para levantamento de valores' },
      { code: 'DESERDACAO_E_INDIGNIDADE', name: 'Deserdação e indignidade' },
      {
        code: 'UNIAO_HOMOAFETIVA_E_MULTIPARENTALIDADE',
        name: 'União homoafetiva e multiparentalidade',
      },
    ],
  },
  {
    /**
     * Consumidor também sai do cível, e pelo mesmo motivo de fundo.
     *
     * Três tipos estavam lá: vício ou fato do produto, cobrança indevida com negativação e
     * negativa de cobertura por plano de saúde. O Código de Defesa do Consumidor não é uma
     * variação do direito civil comum — inverte quem prova, dispensa a culpa, separa vício de
     * fato com prazos próprios para cada um, e trata desigualmente as partes de propósito.
     * Analisar uma negativa de plano de saúde com instrução de contrato paritário perde
     * exatamente o que decide o caso.
     */
    code: 'CONSUMIDOR',
    name: 'Direito do consumidor',
    aliases: ['DIREITO_DO_CONSUMIDOR', 'CDC', 'RELACAO_DE_CONSUMO'],
    caseTypes: [
      { code: 'VICIO_DO_PRODUTO', name: 'Vício do produto' },
      { code: 'VICIO_DO_SERVICO', name: 'Vício do serviço' },
      {
        code: 'FATO_DO_PRODUTO_ACIDENTE_DE_CONSUMO',
        name: 'Fato do produto e acidente de consumo',
      },
      { code: 'FATO_DO_SERVICO', name: 'Fato do serviço' },
      {
        code: 'COBRANCA_INDEVIDA_E_NEGATIVACAO',
        name: 'Cobrança indevida e inscrição em cadastro de inadimplentes',
      },
      {
        code: 'PLANO_SAUDE_NEGATIVA_DE_COBERTURA',
        name: 'Negativa de cobertura por plano de saúde',
      },
      { code: 'PLANO_SAUDE_REAJUSTE', name: 'Reajuste abusivo de plano de saúde' },
      { code: 'PLANO_SAUDE_RESCISAO_UNILATERAL', name: 'Rescisão unilateral de plano de saúde' },
      { code: 'BANCO_FRAUDE_E_GOLPE', name: 'Fraude bancária e transação não reconhecida' },
      {
        code: 'EMPRESTIMO_CONSIGNADO_NAO_CONTRATADO',
        name: 'Empréstimo consignado não contratado',
      },
      { code: 'JUROS_E_TARIFAS_ABUSIVAS', name: 'Juros e tarifas abusivas em contrato bancário' },
      { code: 'SUPERENDIVIDAMENTO', name: 'Repactuação por superendividamento' },
      { code: 'TRANSPORTE_AEREO_ATRASO_E_CANCELAMENTO', name: 'Atraso e cancelamento de voo' },
      { code: 'EXTRAVIO_DE_BAGAGEM', name: 'Extravio ou avaria de bagagem' },
      { code: 'OVERBOOKING', name: 'Preterição de embarque' },
      {
        code: 'TELECOM_COBRANCA_E_SERVICO',
        name: 'Telefonia e internet: cobrança e falha de serviço',
      },
      {
        code: 'ENERGIA_E_SANEAMENTO_CORTE_INDEVIDO',
        name: 'Corte indevido de energia, água ou gás',
      },
      { code: 'COMERCIO_ELETRONICO_NAO_ENTREGA', name: 'Compra pela internet não entregue' },
      {
        code: 'DIREITO_DE_ARREPENDIMENTO',
        name: 'Direito de arrependimento na compra a distância',
      },
      { code: 'PUBLICIDADE_ENGANOSA_OU_ABUSIVA', name: 'Publicidade enganosa ou abusiva' },
      { code: 'PRATICA_ABUSIVA_E_VENDA_CASADA', name: 'Prática abusiva e venda casada' },
      {
        code: 'CLAUSULA_ABUSIVA_EM_CONTRATO_DE_ADESAO',
        name: 'Cláusula abusiva em contrato de adesão',
      },
      { code: 'RECALL_E_VICIO_OCULTO_DE_VEICULO', name: 'Recall e vício oculto de veículo' },
      { code: 'INCORPORACAO_ATRASO_NA_ENTREGA', name: 'Atraso na entrega de imóvel na planta' },
      { code: 'DISTRATO_IMOBILIARIO', name: 'Distrato de compra de imóvel e retenção de valores' },
      { code: 'CURSO_E_MENSALIDADE_ESCOLAR', name: 'Serviço educacional e mensalidade' },
      { code: 'SEGURO_NEGATIVA_DE_SINISTRO', name: 'Negativa de cobertura securitária' },
      {
        code: 'PROTECAO_DE_DADOS_DO_CONSUMIDOR',
        name: 'Uso indevido de dados pessoais do consumidor',
      },
      { code: 'ACAO_COLETIVA_DE_CONSUMO', name: 'Ação coletiva de consumo' },
      { code: 'INVERSAO_DO_ONUS_DA_PROVA', name: 'Incidente de inversão do ônus da prova' },
    ],
  },
  {
    /**
     * Empresarial e societário, que não existia em faixa nenhuma.
     *
     * Não estava escondido no cível como família e consumo: simplesmente não havia. O que o
     * distingue é o sujeito e o tempo. A pessoa jurídica tem existência, órgãos e registro
     * próprios, e nada disso se lê num contrato entre pessoas; e a crise da empresa tem
     * calendário que manda no processo inteiro, com marcos que não existem em lugar nenhum do
     * direito comum.
     */
    code: 'EMPRESARIAL',
    name: 'Direito empresarial e societário',
    aliases: ['DIREITO_EMPRESARIAL', 'SOCIETARIO', 'DIREITO_SOCIETARIO', 'COMERCIAL'],
    caseTypes: [
      { code: 'RECUPERACAO_JUDICIAL', name: 'Recuperação judicial' },
      { code: 'RECUPERACAO_EXTRAJUDICIAL', name: 'Recuperação extrajudicial' },
      { code: 'FALENCIA_PEDIDO', name: 'Pedido de falência' },
      { code: 'FALENCIA_HABILITACAO_DE_CREDITO', name: 'Habilitação e impugnação de crédito' },
      { code: 'DISSOLUCAO_DE_SOCIEDADE', name: 'Dissolução total ou parcial de sociedade' },
      { code: 'APURACAO_DE_HAVERES', name: 'Apuração de haveres do sócio retirante' },
      { code: 'EXCLUSAO_DE_SOCIO', name: 'Exclusão de sócio por falta grave' },
      {
        code: 'CONFLITO_ENTRE_SOCIOS',
        name: 'Conflito societário e quebra da affectio societatis',
      },
      {
        code: 'DESCONSIDERACAO_DA_PERSONALIDADE_JURIDICA',
        name: 'Incidente de desconsideração da personalidade jurídica',
      },
      {
        code: 'RESPONSABILIDADE_DE_ADMINISTRADOR',
        name: 'Responsabilidade civil do administrador',
      },
      {
        code: 'ANULACAO_DE_DELIBERACAO_SOCIAL',
        name: 'Anulação de deliberação de assembleia ou reunião',
      },
      { code: 'ACORDO_DE_SOCIOS_E_QUOTISTAS', name: 'Execução de acordo de sócios ou acionistas' },
      {
        code: 'ALTERACAO_CONTRATUAL_E_REGISTRO',
        name: 'Alteração contratual e registro na junta comercial',
      },
      { code: 'CESSAO_DE_QUOTAS', name: 'Cessão de quotas e direito de preferência' },
      {
        code: 'CONTRATO_DE_DISTRIBUICAO_E_REPRESENTACAO',
        name: 'Distribuição e representação comercial',
      },
      { code: 'CONTRATO_DE_FRANQUIA', name: 'Franquia e circular de oferta' },
      { code: 'CONTRATO_DE_FORNECIMENTO', name: 'Fornecimento empresarial e inadimplemento' },
      {
        code: 'COMPRA_E_VENDA_DE_PARTICIPACAO_SOCIETARIA',
        name: 'Compra e venda de participação societária',
      },
      {
        code: 'TITULOS_DE_CREDITO_EXECUCAO',
        name: 'Execução de duplicata, nota promissória e cheque',
      },
      { code: 'DUPLICATA_SEM_LASTRO_E_PROTESTO', name: 'Duplicata sem lastro e protesto indevido' },
      { code: 'SUSTACAO_DE_PROTESTO', name: 'Sustação de protesto' },
      {
        code: 'MARCA_E_CONCORRENCIA_DESLEAL',
        name: 'Uso indevido de marca e concorrência desleal',
      },
      { code: 'TRESPASSE_DE_ESTABELECIMENTO', name: 'Trespasse de estabelecimento e sucessão' },
      { code: 'ARBITRAGEM_EMPRESARIAL', name: 'Cláusula compromissória e arbitragem' },
      { code: 'DIREITO_DE_RETIRADA', name: 'Direito de retirada e reembolso' },
    ],
  },
  {
    /**
     * Administrativo, também ausente até aqui.
     *
     * A faixa tem uma assimetria que nenhuma outra tem: de um lado está a administração, que
     * decide antes de ser processada e cujos atos já nascem produzindo efeito, e do outro o
     * particular ou o servidor. Por isso quase todo caso começa fora do Judiciário, num processo
     * administrativo com prazo, publicação e ato formal — e é nessa peça, não na inicial, que
     * estão as datas que decidem.
     */
    code: 'ADMINISTRATIVO',
    name: 'Direito administrativo',
    aliases: ['DIREITO_ADMINISTRATIVO', 'ADMINISTRACAO_PUBLICA', 'PUBLICO'],
    caseTypes: [
      { code: 'LICITACAO_IMPUGNACAO_DE_EDITAL', name: 'Impugnação de edital de licitação' },
      { code: 'LICITACAO_RECURSO_ADMINISTRATIVO', name: 'Recurso administrativo em licitação' },
      {
        code: 'LICITACAO_INABILITACAO_E_DESCLASSIFICACAO',
        name: 'Inabilitação e desclassificação',
      },
      { code: 'CONTRATO_ADMINISTRATIVO_REEQUILIBRIO', name: 'Reequilíbrio econômico-financeiro' },
      { code: 'CONTRATO_ADMINISTRATIVO_RESCISAO', name: 'Rescisão de contrato administrativo' },
      {
        code: 'SANCAO_ADMINISTRATIVA_A_LICITANTE',
        name: 'Sanção a licitante e declaração de inidoneidade',
      },
      {
        code: 'PAGAMENTO_A_FORNECEDOR_DA_ADMINISTRACAO',
        name: 'Cobrança de fornecedor contra a administração',
      },
      {
        code: 'SERVIDOR_CONCURSO_PUBLICO',
        name: 'Concurso público: aprovação, nomeação e preterição',
      },
      { code: 'SERVIDOR_PROCESSO_DISCIPLINAR', name: 'Processo administrativo disciplinar' },
      { code: 'SERVIDOR_DEMISSAO_E_REINTEGRACAO', name: 'Demissão de servidor e reintegração' },
      {
        code: 'SERVIDOR_VANTAGENS_E_GRATIFICACOES',
        name: 'Vantagens, gratificações e reenquadramento',
      },
      {
        code: 'SERVIDOR_APOSENTADORIA_ESTATUTARIA',
        name: 'Aposentadoria de servidor e registro pelo tribunal de contas',
      },
      { code: 'IMPROBIDADE_ADMINISTRATIVA', name: 'Ação de improbidade administrativa' },
      { code: 'TOMADA_DE_CONTAS_E_TCU', name: 'Tomada de contas e imputação de débito' },
      { code: 'RESPONSABILIDADE_CIVIL_DO_ESTADO', name: 'Responsabilidade civil do Estado' },
      { code: 'DESAPROPRIACAO', name: 'Desapropriação e justa indenização' },
      { code: 'SERVIDAO_ADMINISTRATIVA', name: 'Servidão administrativa' },
      { code: 'PODER_DE_POLICIA_MULTA', name: 'Auto de infração e multa administrativa' },
      { code: 'LICENCA_E_ALVARA', name: 'Licença, alvará e cassação' },
      {
        code: 'SAUDE_FORNECIMENTO_DE_MEDICAMENTO',
        name: 'Fornecimento de medicamento e tratamento',
      },
      { code: 'VAGA_EM_CRECHE_E_ENSINO', name: 'Vaga em creche e acesso ao ensino' },
      {
        code: 'MANDADO_DE_SEGURANCA_ADMINISTRATIVO',
        name: 'Mandado de segurança contra ato de autoridade',
      },
      { code: 'ACAO_POPULAR', name: 'Ação popular' },
      { code: 'ACESSO_A_INFORMACAO', name: 'Pedido de acesso à informação e negativa' },
      {
        code: 'PERMISSAO_E_CONCESSAO_DE_SERVICO',
        name: 'Permissão e concessão de serviço público',
      },
    ],
  },
  {
    /**
     * Ambiental, a primeira das quatro que sobraram depois das nove de maior volume.
     *
     * Vem antes das outras três por frequência: cliente empresarial esbarra em licenciamento e em
     * auto de infração o ano inteiro. O crime ambiental fica no penal, onde já estava catalogado —
     * o rito é de processo penal e duplicar a matéria criaria duas instruções divergindo sobre a
     * mesma denúncia.
     */
    code: 'AMBIENTAL',
    name: 'Direito ambiental',
    aliases: ['DIREITO_AMBIENTAL', 'MEIO_AMBIENTE'],
    caseTypes: [
      { code: 'LICENCA_PREVIA', name: 'Licença prévia e viabilidade do empreendimento' },
      { code: 'LICENCA_DE_INSTALACAO', name: 'Licença de instalação' },
      { code: 'LICENCA_DE_OPERACAO', name: 'Licença de operação' },
      { code: 'RENOVACAO_DE_LICENCA', name: 'Renovação de licença ambiental' },
      { code: 'CUMPRIMENTO_DE_CONDICIONANTE', name: 'Cumprimento de condicionante de licença' },
      { code: 'ESTUDO_DE_IMPACTO_E_AUDIENCIA', name: 'Estudo de impacto e audiência pública' },
      { code: 'AUTO_DE_INFRACAO_AMBIENTAL', name: 'Auto de infração ambiental e defesa' },
      { code: 'MULTA_AMBIENTAL_E_CONVERSAO', name: 'Multa ambiental e conversão em serviços' },
      { code: 'EMBARGO_E_INTERDICAO', name: 'Embargo de obra e interdição de atividade' },
      { code: 'APREENSAO_DE_BENS_E_PRODUTOS', name: 'Apreensão de bens e produtos' },
      { code: 'TERMO_DE_AJUSTAMENTO_DE_CONDUTA', name: 'Termo de ajustamento de conduta' },
      { code: 'INQUERITO_CIVIL_AMBIENTAL', name: 'Inquérito civil ambiental' },
      { code: 'ACAO_CIVIL_PUBLICA_AMBIENTAL', name: 'Ação civil pública ambiental' },
      { code: 'REPARACAO_DE_DANO_AMBIENTAL', name: 'Reparação de dano ambiental' },
      { code: 'PLANO_DE_RECUPERACAO_DE_AREA', name: 'Plano de recuperação de área degradada' },
      {
        code: 'AREA_DE_PRESERVACAO_PERMANENTE',
        name: 'Intervenção em área de preservação permanente',
      },
      { code: 'RESERVA_LEGAL_E_AVERBACAO', name: 'Reserva legal e sua inscrição' },
      { code: 'CADASTRO_AMBIENTAL_RURAL', name: 'Cadastro ambiental rural e regularização' },
      { code: 'SUPRESSAO_DE_VEGETACAO', name: 'Autorização de supressão de vegetação' },
      { code: 'OUTORGA_DE_USO_DE_AGUA', name: 'Outorga de direito de uso de recursos hídricos' },
      { code: 'POLUICAO_E_EMISSOES', name: 'Poluição atmosférica, hídrica e sonora' },
      {
        code: 'RESIDUOS_SOLIDOS_E_LOGISTICA_REVERSA',
        name: 'Resíduos sólidos e logística reversa',
      },
      { code: 'AREA_CONTAMINADA', name: 'Área contaminada e passivo ambiental' },
      { code: 'COMPENSACAO_AMBIENTAL', name: 'Compensação ambiental' },
      { code: 'UNIDADE_DE_CONSERVACAO', name: 'Unidade de conservação e zona de amortecimento' },
    ],
  },
  {
    /**
     * Propriedade intelectual.
     *
     * Marca e concorrência desleal continuam no empresarial, onde o tipo de caso já existe e onde
     * a concorrência desleal de fato pertence — é ilícito de mercado, não de registro. Esta faixa
     * declara o que aquele tipo não cobre: o procedimento perante o instituto de registro, a
     * patente, o desenho industrial, o direito autoral e o software.
     */
    code: 'PROPRIEDADE_INTELECTUAL',
    name: 'Propriedade intelectual',
    aliases: ['PI', 'DIREITO_AUTORAL', 'MARCAS_E_PATENTES', 'PROPRIEDADE_INDUSTRIAL'],
    caseTypes: [
      { code: 'PEDIDO_DE_REGISTRO_DE_MARCA', name: 'Pedido de registro de marca' },
      { code: 'OPOSICAO_A_REGISTRO_DE_MARCA', name: 'Oposição a pedido de registro' },
      { code: 'NULIDADE_DE_REGISTRO_DE_MARCA', name: 'Processo administrativo de nulidade' },
      { code: 'CADUCIDADE_DE_MARCA', name: 'Caducidade por desuso' },
      { code: 'ACAO_DE_NULIDADE_DE_MARCA', name: 'Ação judicial de nulidade de registro' },
      {
        code: 'ABSTENCAO_DE_USO_DE_MARCA',
        name: 'Abstenção de uso e indenização por uso indevido',
      },
      { code: 'PEDIDO_DE_PATENTE', name: 'Pedido de patente de invenção' },
      { code: 'MODELO_DE_UTILIDADE', name: 'Modelo de utilidade' },
      { code: 'EXIGENCIA_TECNICA_EM_PATENTE', name: 'Cumprimento de exigência técnica' },
      { code: 'NULIDADE_DE_PATENTE', name: 'Nulidade de patente' },
      { code: 'INFRACAO_DE_PATENTE', name: 'Infração de patente' },
      { code: 'DESENHO_INDUSTRIAL', name: 'Registro de desenho industrial' },
      { code: 'DIREITO_AUTORAL_OBRA', name: 'Autoria e titularidade de obra' },
      { code: 'VIOLACAO_DE_DIREITO_AUTORAL', name: 'Violação de direito autoral' },
      { code: 'DIREITO_CONEXO_E_EXECUCAO_PUBLICA', name: 'Direitos conexos e execução pública' },
      { code: 'REGISTRO_DE_SOFTWARE', name: 'Registro de programa de computador' },
      { code: 'CONTRATO_DE_LICENCIAMENTO', name: 'Contrato de licenciamento e royalties' },
      { code: 'CESSAO_DE_DIREITOS', name: 'Cessão de direitos patrimoniais' },
      { code: 'TRANSFERENCIA_DE_TECNOLOGIA', name: 'Transferência de tecnologia e averbação' },
      { code: 'NOME_DE_DOMINIO', name: 'Conflito sobre nome de domínio' },
      { code: 'SEGREDO_DE_NEGOCIO', name: 'Segredo de negócio e informação confidencial' },
      { code: 'INDICACAO_GEOGRAFICA', name: 'Indicação geográfica' },
      {
        code: 'BUSCA_E_APREENSAO_DE_CONTRAFACAO',
        name: 'Busca e apreensão de produto contrafeito',
      },
      { code: 'PIRATARIA_E_PLATAFORMAS', name: 'Remoção de conteúdo infrator em plataforma' },
    ],
  },
  {
    /**
     * Agrário. O agronegócio move o país e a matéria não estava em faixa nenhuma.
     *
     * Encosta em três já catalogadas e não as repete: aposentadoria rural fica no
     * previdenciário, cadastro ambiental rural e reserva legal ficam no ambiental, e usucapião
     * genérica fica no cível. O que é próprio daqui é o título de crédito do campo, o contrato de
     * uso da terra, a regularização fundiária e o conflito possessório coletivo.
     */
    code: 'AGRARIO',
    name: 'Direito agrário e do agronegócio',
    aliases: ['DIREITO_AGRARIO', 'AGRONEGOCIO', 'RURAL'],
    caseTypes: [
      { code: 'CEDULA_DE_PRODUTO_RURAL', name: 'Cédula de produto rural e sua execução' },
      { code: 'CREDITO_RURAL_E_CUSTEIO', name: 'Crédito rural, custeio e renegociação' },
      { code: 'PENHOR_E_ALIENACAO_DE_SAFRA', name: 'Penhor agrícola e alienação de safra' },
      { code: 'ARRENDAMENTO_RURAL', name: 'Arrendamento rural' },
      { code: 'PARCERIA_AGRICOLA_E_PECUARIA', name: 'Parceria agrícola e pecuária' },
      { code: 'COMPRA_E_VENDA_DE_SAFRA', name: 'Compra e venda de safra e inadimplemento' },
      { code: 'BARTER_E_INSUMOS', name: 'Operação de troca de insumos por produto' },
      { code: 'ARMAZENAGEM_E_DEPOSITO', name: 'Armazenagem, depósito e certificado' },
      { code: 'SEGURO_RURAL_E_SINISTRO', name: 'Seguro rural e negativa de sinistro' },
      { code: 'REGULARIZACAO_FUNDIARIA', name: 'Regularização fundiária e titulação' },
      { code: 'USUCAPIAO_RURAL', name: 'Usucapião de imóvel rural' },
      { code: 'DESAPROPRIACAO_PARA_REFORMA_AGRARIA', name: 'Desapropriação para reforma agrária' },
      {
        code: 'IMISSAO_E_REINTEGRACAO_DE_POSSE_RURAL',
        name: 'Reintegração de posse de área rural',
      },
      { code: 'CONFLITO_POSSESSORIO_COLETIVO', name: 'Conflito possessório coletivo' },
      { code: 'DEMARCACAO_E_DIVISAO', name: 'Demarcação, divisão e georreferenciamento' },
      { code: 'IMOVEL_RURAL_CADASTRO_E_ITR', name: 'Cadastro do imóvel rural e ITR' },
      { code: 'MODULO_RURAL_E_FRACIONAMENTO', name: 'Módulo rural e limite ao fracionamento' },
      { code: 'AQUISICAO_POR_ESTRANGEIRO', name: 'Aquisição de terra por estrangeiro' },
      { code: 'DEFESA_AGROPECUARIA', name: 'Defesa agropecuária e sanidade' },
      { code: 'CONTRATO_DE_INTEGRACAO', name: 'Contrato de integração na produção animal' },
    ],
  },
  {
    /**
     * Eleitoral, por último entre as quatro, e por um motivo declarado: é a mais sazonal.
     *
     * O volume concentra-se no ano de pleito e nos meses seguintes, o que a torna a menos usada
     * das quatro no calendário de um escritório de banca completa — mas a de prazo mais curto
     * quando aparece, e por isso vale existir com instrução própria em vez de cair no genérico.
     */
    code: 'ELEITORAL',
    name: 'Direito eleitoral',
    aliases: ['DIREITO_ELEITORAL', 'ELEICOES'],
    caseTypes: [
      { code: 'REGISTRO_DE_CANDIDATURA', name: 'Pedido de registro de candidatura' },
      { code: 'IMPUGNACAO_DE_REGISTRO', name: 'Impugnação ao registro de candidatura' },
      { code: 'INELEGIBILIDADE', name: 'Arguição de inelegibilidade' },
      { code: 'PRESTACAO_DE_CONTAS_DE_CAMPANHA', name: 'Prestação de contas de campanha' },
      { code: 'PRESTACAO_DE_CONTAS_PARTIDARIAS', name: 'Prestação de contas anual do partido' },
      { code: 'DOACAO_ACIMA_DO_LIMITE', name: 'Doação acima do limite legal' },
      { code: 'PROPAGANDA_ELEITORAL_IRREGULAR', name: 'Propaganda eleitoral irregular' },
      { code: 'DIREITO_DE_RESPOSTA_ELEITORAL', name: 'Direito de resposta' },
      { code: 'PROPAGANDA_ANTECIPADA', name: 'Propaganda antecipada negativa' },
      { code: 'DESINFORMACAO_E_REMOCAO_DE_CONTEUDO', name: 'Desinformação e remoção de conteúdo' },
      { code: 'ABUSO_DE_PODER_ECONOMICO', name: 'Abuso de poder econômico' },
      { code: 'ABUSO_DE_PODER_POLITICO', name: 'Abuso de poder político e uso da máquina' },
      { code: 'CONDUTA_VEDADA_A_AGENTE_PUBLICO', name: 'Conduta vedada a agente público' },
      { code: 'CAPTACAO_ILICITA_DE_SUFRAGIO', name: 'Captação ilícita de sufrágio' },
      { code: 'ACAO_DE_INVESTIGACAO_JUDICIAL', name: 'Ação de investigação judicial eleitoral' },
      { code: 'RECURSO_CONTRA_DIPLOMACAO', name: 'Recurso contra expedição de diploma' },
      { code: 'ACAO_DE_IMPUGNACAO_DE_MANDATO', name: 'Ação de impugnação de mandato eletivo' },
      { code: 'CRIME_ELEITORAL', name: 'Crime eleitoral' },
      { code: 'FILIACAO_PARTIDARIA_E_DUPLICIDADE', name: 'Filiação partidária e duplicidade' },
      { code: 'CONVENCAO_E_ORGAO_PARTIDARIO', name: 'Convenção partidária e órgão de direção' },
      {
        code: 'FUNDO_PARTIDARIO_E_FUNDO_ELEITORAL',
        name: 'Aplicação do fundo partidário e eleitoral',
      },
      { code: 'AUDITORIA_E_URNA', name: 'Auditoria, urna e apuração' },
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
