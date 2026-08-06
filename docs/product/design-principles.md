# Fundação de design do LEX OS

**Status:** Fundação — precede a Delivery 10
**Última atualização:** 2026-08-05
**Idioma:** pt-BR. Documentos voltados à sociedade e ao produto ficam em pt-BR; documentação de engenharia segue em inglês, conforme `AGENTS.md`.

## Para quem estamos desenhando

Sócios e advogados de escritórios estabelecidos. Pessoas que passam o dia lendo documento denso, que julgam credibilidade em segundos e que já usam software jurídico ruim o suficiente para reconhecer software bom.

O comprador não está adquirindo uma ferramenta auxiliar. A proposta posiciona o LEX OS como a plataforma central de inteligência operacional do escritório. Uma tela com cara de painel administrativo genérico contradiz esse posicionamento antes de qualquer argumento de venda.

## O que "premium" significa aqui

Não significa ornamento. Para este público, premium é **contenção, densidade e previsibilidade**.

| Premium é                                                  | Premium não é                               |
| ---------------------------------------------------------- | ------------------------------------------- |
| Tipografia com hierarquia clara e escala consciente        | Fontes decorativas                          |
| Muito branco onde ajuda a ler, denso onde ajuda a comparar | Espaçamento uniforme e frouxo em tudo       |
| Cor com significado, quase ausente fora disso              | Paleta colorida, gradientes, cards festivos |
| Movimento curto, funcional, que explica uma transição      | Animação de entrada em cada elemento        |
| O sistema responde igual toda vez                          | Surpresas, layouts que pulam                |
| Estado de erro que diz o que fazer                         | "Algo deu errado"                           |

A régua: a tela precisa parecer confiável o suficiente para ser projetada numa reunião com cliente.

## Princípios

**1. O documento é o protagonista, a interface é moldura.**
Todo pixel de cromo disputa espaço com o material jurídico. Quando houver dúvida entre mostrar mais interface ou mais conteúdo, mostre conteúdo.

**2. Densidade é respeito.**
Um advogado comparando vinte documentos não quer rolar vinte telas. Listas são compactas e escaneáveis. Espaço em branco é usado para separar grupos, não para preencher.

**3. Máquina e humano nunca se confundem visualmente.**
Este é o principal desafio de design do produto, não um detalhe. O `vision.md` promete que ações humanas e de máquina sejam distinguíveis e auditáveis. Isso é, na prática, um problema de interface.

**4. Nenhuma afirmação sem caminho para a fonte.**
Todo dado extraído por IA exibe, ou revela sob interação, de onde veio: documento, página, trecho. Se não há fonte, não se exibe o dado.

**5. Estado assíncrono é primeira classe.**
O processamento é a experiência central. Progresso, falha parcial e recuperação após recarregar a página não são casos de borda — são a tela principal.

**6. Nada de rótulo técnico vazando.**
`NEEDS_REVIEW` não aparece para o usuário. `Aguardando revisão`, sim.

## Distinguir IA de humano

O padrão, aplicado consistentemente em toda a interface:

| Origem                          | Tratamento visual                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Extraído por IA, não confirmado | Valor em peso normal, com marcador discreto de origem e affordance de confirmação |
| Confirmado por humano           | Peso pleno, sem marcador, com quem confirmou e quando disponível em detalhe       |
| Corrigido por humano            | Peso pleno, com o valor original preservado e acessível                           |
| Inferido sem fonte              | Não existe. Não é exibido                                                         |

O marcador de origem deve ser sóbrio — uma marca tipográfica ou um ícone pequeno de peso leve, nunca um selo colorido chamativo. O objetivo é que o advogado saiba, não que a tela grite.

Confirmar deve custar um clique. Revisar em lote precisa existir desde o primeiro dia, porque um caso tem centenas de entidades extraídas.

## Cor

Paleta restrita e semântica. Cor carrega informação; onde não carrega, não aparece.

- **Neutros** fazem quase todo o trabalho: fundo, superfície, borda, texto primário e secundário. Frios, puxados na direção do azul-aço da marca — cinza puro lê como padrão de framework, não como escolha.
- **Uma cor de marca**, usada com parcimônia em ação primária e estado ativo.
- **Estados semânticos** — atenção, erro, sucesso, e um tratamento próprio e inequívoco para **confidencial**.
- Confidencialidade nunca é comunicada só por cor. Combina cor, hachura e rótulo, porque a consequência de errar é vazamento de informação sigilosa.

**Escuro é o tratamento principal**, com modo claro disponível. Os dois recebem o mesmo cuidado; o claro não é uma inversão automática do escuro.

### Valores propostos — v0, aguardando aprovação

| Token          | Escuro    | Claro     | Uso                                          |
| -------------- | --------- | --------- | -------------------------------------------- |
| `ink`          | `#5AA9F0` | `#0B4E8F` | Ação primária, estado ativo. Nada além disso |
| `on-ink`       | `#04121F` | `#FFFFFF` | Texto sobre a cor de marca                   |
| `paper`        | `#07090A` | `#F4F7F8` | Fundo da aplicação                           |
| `surface`      | `#0D1113` | `#FFFFFF` | Painel, tabela, campo                        |
| `surface-sunk` | `#141A1D` | `#E9EEF1` | Cabeçalho de painel, linha em hover          |
| `line`         | `#36454D` | `#ADBCC4` | Régua divisória                              |
| `line-strong`  | `#5A6C76` | `#7D8D96` | Contorno de componente interativo            |
| `text`         | `#F4F7F8` | `#05090B` | Leitura primária                             |
| `text-2`       | `#B3C0C6` | `#3D484E` | Apoio, metadado, rótulo                      |
| `text-3`       | `#87949B` | `#626E75` | Terciário. Nunca para informação essencial   |
| `pendente`     | `#F0B44E` | `#7A4E05` | Aguardando revisão humana                    |
| `confirmado`   | `#55D18B` | `#10502C` | Validado por pessoa                          |
| `rejeitado`    | `#FF8D84` | `#8E1912` | Falha, recusa, arquivo inválido              |
| `sigilo`       | `#C39BF5` | `#4E2380` | Confidencialidade. Nunca reutilizar          |

### Contraste

Mínimo de 4.5:1 para texto e 3:1 para contorno de componente interativo e indicador de foco. Não é opcional: parte do público tem presbiopia e trabalha em monitor ruim.

Régua divisória é elemento decorativo e não está sujeita ao 1.4.11 da WCAG, mas mesmo assim tem piso próprio de 1.7:1 — abaixo disso a estrutura da tabela some e a interface parece lavada.

Os valores acima foram medidos, não estimados: todos os pares texto/fundo e contorno/fundo passam nos dois temas.

## Tipografia

Uma escala definida, poucos degraus, aplicada sem exceção. Texto de leitura longa com medida controlada — documento jurídico já é denso, linha de 140 caracteres torna a leitura pior. Números tabulares em listas e valores monetários, para as colunas alinharem.

A escala fica **um degrau acima do comum em software de gestão**: corpo em 16px, não 15px. O público lê documento denso o dia inteiro e boa parte trabalha em monitor ruim; economizar pixel de texto aqui não é elegância, é desconforto.

| Token     | Valor    | Uso                               |
| --------- | -------- | --------------------------------- |
| `step--1` | 0.875rem | Metadado, rótulo, célula de lista |
| `step-0`  | 1rem     | Corpo                             |
| `step-1`  | 1.25rem  | Subtítulo                         |
| `step-2`  | 1.75rem  | Título de seção                   |
| `step-3`  | 2.375rem | Título de página                  |

## Forma e aproveitamento de tela

Cantos suaves, sem virar aplicativo de consumo. O raio cresce com a superfície: painel arredonda mais que controle, e marcador de estado quase nada, para não virar pílula.

| Token       | Valor | Uso                         |
| ----------- | ----- | --------------------------- |
| `radius-sm` | 4px   | Marcador de estado          |
| `radius`    | 7px   | Botão, campo                |
| `radius-lg` | 12px  | Painel, card, área de envio |

`content-max` é **108rem**. A interface ocupa a tela: software de revisão documental se beneficia de largura, porque mais colunas visíveis significa menos rolagem e menos comparação feita de cabeça. Largura confortável de leitura continua valendo para texto corrido, não para tabela.

## Estados obrigatórios

Nenhuma tela é considerada pronta sem os quatro:

1. **Carregando** — com forma que antecipa o conteúdo, não spinner centralizado.
2. **Vazio** — explica o que apareceria ali e oferece a próxima ação.
3. **Erro** — diz o que aconteceu, se é recuperável, e qual é o próximo passo. Nunca expõe detalhe interno.
4. **Parcial** — específico deste produto: o processamento terminou com parte dos arquivos aceita e parte rejeitada. Esse resultado misto é o caso comum, não a exceção.

## Texto da interface

pt-BR em registro jurídico correto. `reclamante`, `polo ativo`, `protocolo` — o vocabulário do público, não tradução de software estrangeiro.

Frases curtas. Verbo no infinitivo em botões de ação. Sem exclamação, sem tom simpático artificial, sem "Ops!". O usuário está trabalhando em algo que pode ter consequência processual.

## Acessibilidade como requisito, não como extra

Navegação completa por teclado no fluxo crítico. Foco sempre visível. Ordem de leitura coerente para leitor de tela. Alvos de toque adequados. Isso está nos critérios de aceite da Delivery 10 e não é negociável.

## O que ainda não foi decidido

Estas escolhas ficam para quando a Delivery 10 for autorizada, e devem ser feitas com a interface real na frente, não no papel:

- **família tipográfica.** A referência visual usa fontes de sistema porque a política de segurança do navegador bloqueia CDN de fonte. A escolha definitiva exige licença e teste em documento denso;
- **biblioteca de componentes ou construção própria** sobre primitivos acessíveis;
- **a marca.** O azul-aço é proposta, não identidade aprovada. Se houver marca de escritório-piloto envolvida, a paleta muda.

Já decididos e registrados acima: a paleta (v0, aguardando aprovação), o escuro como tratamento principal com modo claro, e os três papéis tipográficos.

## Referência visual

A fundação está publicada como página navegável para aprovação, com paleta ao vivo nos dois temas, o marcador de procedência funcionando, a lista densa e os quatro estados. Ela é o artefato que se aprova — documento escrito não substitui ver.

<https://claude.ai/code/artifact/55476f9c-ec73-4512-967a-fc63ee7e6703>

A página é privada por padrão; o acesso é liberado pelo menu de compartilhamento. Ao alterar a paleta aqui, republique a referência no mesmo endereço para os dois não divergirem.

## Manutenção

Atualizar quando uma decisão da seção anterior for tomada. Toda tela nova é verificada contra os princípios e contra os quatro estados obrigatórios antes de ser considerada concluída.
