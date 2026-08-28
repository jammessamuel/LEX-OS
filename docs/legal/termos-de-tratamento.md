# Termos de tratamento de dados

- **Versão:** 2 · **Vigente desde:** 2026-08-28
- **Exigida por:** ADR-011 e ADR-012
- **Natureza:** registro técnico para instruir contratos. **Não é parecer jurídico nem contrato
  assinado.** A redação final precisa de advogado e da aceitação das contrapartes.

---

## 1. Papéis

O escritório contratante é o **controlador** do acervo de seus casos. A **SAMUEL DEV LTDA** é
operadora: trata o conteúdo apenas para prestar o LEX OS e conforme as instruções documentadas do
controlador. Fornecedores de hospedagem, armazenamento e IA são suboperadores.

Parte contrária, testemunha, terceiro, criança ou pessoa mencionada em laudo pode ser titular de
dados sem jamais ter contratado o escritório ou o LEX OS. O contrato com o escritório não cria
consentimento dessas pessoas.

## 2. Dados tratados

| Categoria           | Exemplos                                                                | Origem                                                      |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Identificação       | Nome, documento, endereço e contato                                     | Cadastro e documentos enviados                              |
| Conteúdo processual | Petições, decisões, contratos, comprovantes, laudos e mensagens         | Upload autenticado pelo escritório                          |
| Texto e índices     | Texto extraído, segmentos e vetores de busca                            | Derivados do original preservado                            |
| Dados derivados     | Cronologia, entidades, classificação, checklist e resposta fundamentada | Proposta automatizada, com fonte e revisão humana quando há |
| Dados operacionais  | Conta, sessão, auditoria, fila e custo                                  | Uso do sistema                                              |

O conteúdo pode conter dado sensível, dado de criança e informação coberta por sigilo. O sistema
não consegue garantir que um documento não contenha essas categorias antes de recebê-lo.

## 3. Base legal

O controlador define e documenta a base legal para cada finalidade. Exercício regular de direitos
em processo e cumprimento de obrigação legal são hipóteses frequentes, mas não são declaradas
automaticamente pelo LEX OS em nome de cada escritório.

Consentimento não é a saída padrão: parte contrária e terceiro não deram consentimento, e a
transferência internacional exige tanto uma base legal dos artigos 7º ou 11 da LGPD quanto um dos
mecanismos do artigo 33 e da regulamentação da ANPD.

## 4. Retenção e exclusão

- preservar por padrão; nenhum expurgo automático;
- exclusão lógica como única exclusão do MVP;
- _legal hold_ no caso bloqueia todo caminho de exclusão e falha fechado;
- exclusão e mudança de _hold_ são auditadas com autor, horário e motivo;
- fornecedor só pode reter pelo prazo contratualmente registrado e necessário à finalidade.

A política conservadora protege prova, mas não autoriza retenção ilimitada sem justificativa. O
controlador deve definir prazos e critérios por categoria antes da contratação de produção.

## 5. Atendimento a titulares

| Situação                        | Responsável pela decisão           | Papel da SAMUEL DEV LTDA                                                                                  |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Titular é cliente do escritório | Escritório controlador             | Localizar, exportar, corrigir ou restringir conforme instrução válida                                     |
| Titular é parte contrária       | Escritório controlador             | Preservar prova e suporte ao exercício de direitos; não apagar automaticamente                            |
| Pedido chega ao LEX OS          | Responsável público de privacidade | Protocolar, verificar identidade, localizar o controlador e encaminhar sem revelar a existência de acervo |

**Estado:** ainda não há ato societário assinado nem canal público confirmado. O modelo de
nomeação e o procedimento estão no
[`pacote-liberacao-acervo-real.md`](./pacote-liberacao-acervo-real.md). Sem nome, canal e aceite da
pessoa, o portão permanece aberto.

## 6. Transferência internacional

A instalação atual usa a Railway em Amsterdam, Países Baixos. O DPA da Railway também informa
operações primárias nos EUA e controles de backup em múltiplos locais/regiões. A Anthropic
informa armazenamento nos EUA e processamento potencial em vários continentes.

A Resolução CD/ANPD nº 19/2024 exige base legal e mecanismo válido. Para esta cadeia, a rota
recomendada é:

1. inserir integralmente as cláusulas-padrão do Anexo II da Resolução 19/2024 nos instrumentos
   entre exportador e importador, sem alteração do texto obrigatório;
2. preencher a descrição da transferência, países, finalidade, categorias, duração, medidas de
   segurança, subprocessadores e contatos;
3. publicar informação clara em português e disponibilizar as cláusulas ao titular quando
   solicitado, nos termos da resolução;
4. obter a assinatura das contrapartes antes do primeiro dado real.

As cláusulas resolvem o **mecanismo jurídico de transferência**, mas não resolvem sozinhas a
regra interna de região única do ADR-012. Railway e Anthropic precisam aceitar limitação regional
compatível, ou a sociedade precisa aprovar novo ADR após parecer jurídico. Até lá,
`CASE_ARCHIVE=fictional` continua obrigatório.

## 7. Provedor de modelo

Os Termos Comerciais da Anthropic contêm compromisso de não usar conteúdo do cliente para treinar
modelos, e o DPA coloca a Anthropic como operadora. Para esse compromisso cobrir o LEX OS:

- a organização contratante da API deve pertencer à SAMUEL DEV LTDA;
- o aceite deve ser feito por representante com poderes e guardado como evidência;
- o _Development Partner Program_ deve permanecer desativado;
- a retenção efetiva deve ser registrada — padrão de até 30 dias ou acordo de retenção zero;
- localização, subprocessadores e transferências devem cumprir a seção 6.

Uma chave emitida em conta pessoal de sócio não é evidência de contratação pela empresa.

## 8. Portões para acervo real

| Portão                                                                      | Estado em 2026-08-28 |
| --------------------------------------------------------------------------- | -------------------- |
| Lista de suboperadores corresponde ao que está ligado                       | Concluído            |
| _Legal hold_ falha fechado                                                  | Concluído            |
| Custo por execução, agregação e teto por caso                               | Concluído            |
| Texto contratual padrão do fornecedor proíbe treinamento                    | Verificado           |
| Conta comercial e aceite em nome da SAMUEL DEV LTDA                         | Pendente             |
| Retenção efetiva e participação em programa de compartilhamento comprovadas | Pendente             |
| Cláusulas-padrão brasileiras executadas com cada importador                 | Pendente             |
| Regra de região única atendida ou substituída por novo ADR                  | Pendente             |
| Responsável e canal público de atendimento nomeados                         | Pendente             |
| Quinze prompts especializados atestados por advogado com OAB ativa          | Pendente             |

## 9. Fontes normativas e contratuais

- [LGPD — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [ANPD — Resolução CD/ANPD nº 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)
- [Railway — Data Processing Addendum](https://railway.com/legal/dpa)
- [Anthropic — Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- [Anthropic — Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum)

## 10. Histórico

| Versão | Data       | Mudança                                                                                                                                                   |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2      | 2026-08-28 | Corrige localização, separa base legal de mecanismo de transferência, registra termos da Anthropic e explicita os quatro atos externos ainda necessários. |
| 1      | 2026-08-27 | Primeiro registro técnico.                                                                                                                                |
