# Folha de montagem — transferência internacional

**MODELO DE TRABALHO, NÃO INSTRUMENTO ASSINADO.** O texto obrigatório é o Anexo II da
[Resolução CD/ANPD nº 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024).
Ele deve ser incorporado integralmente, sem modificação, por advogado e contraparte.

## 1. Exportador

| Campo                                | Preenchimento            |
| ------------------------------------ | ------------------------ |
| Razão social                         | SAMUEL DEV LTDA          |
| CNPJ                                 |                          |
| Endereço                             |                          |
| Representante e poderes              |                          |
| Contato de privacidade               |                          |
| Papel na cadeia                      | Operadora/suboperadora   |
| Controladores em nome dos quais atua | Escritórios contratantes |

## 2. Instrumento Railway

| Campo                           | Preenchimento                                          |
| ------------------------------- | ------------------------------------------------------ |
| Importador                      | Railway Corporation                                    |
| País contratual declarado       | Estados Unidos                                         |
| Região do workload/volumes      | Amsterdam, Países Baixos (`europe-west4-drams3a`)      |
| Finalidade                      | Hospedagem de API, worker, PostgreSQL, Redis e objetos |
| Categorias                      | Todo o acervo e dados operacionais do LEX OS           |
| Frequência                      | Contínua enquanto o serviço estiver ativo              |
| DPA do fornecedor               | <https://railway.com/legal/dpa>                        |
| Contato publicado no DPA        | `privacy@railway.com`                                  |
| Cláusulas ANPD anexadas         |                                                        |
| Limitação regional aceita       |                                                        |
| Subprocessadores conferidos     |                                                        |
| Assinaturas e data              |                                                        |
| Referência interna da evidência |                                                        |

**Alerta:** o DPA padrão da Railway declara operações primárias nos EUA e backups em múltiplos
locais/regiões. Sem compromisso adicional, a regra de região única do ADR-012 não está atendida.

## 3. Instrumento Anthropic

| Campo                           | Preenchimento                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Importador                      | Anthropic, PBC                                                                  |
| Localizações declaradas         | Armazenamento nos EUA; processamento possível nos EUA, Europa, Ásia e Austrália |
| Finalidade                      | Gerar resposta a partir de pergunta e até cinco trechos autorizados             |
| Categorias                      | Conteúdo processual e potencial dado pessoal/sensível contido nos trechos       |
| Frequência                      | A cada pergunta que efetivamente aciona o provedor                              |
| Retenção                        | Até 30 dias por padrão; preencher acordo efetivo                                |
| Termos Comerciais               | <https://www.anthropic.com/legal/commercial-terms>                              |
| DPA                             | <https://www.anthropic.com/legal/data-processing-addendum>                      |
| Organização da SAMUEL DEV LTDA  |                                                                                 |
| Programa de compartilhamento    |                                                                                 |
| Cláusulas ANPD anexadas         |                                                                                 |
| Limitação regional aceita       |                                                                                 |
| Subprocessadores conferidos     |                                                                                 |
| Assinaturas e data              |                                                                                 |
| Referência interna da evidência |                                                                                 |

**Alerta:** compromisso de não treinamento não resolve localização, retenção ou transferência.

## 4. Conteúdo obrigatório a conferir

- [ ] texto integral e inalterado das cláusulas-padrão da ANPD;
- [ ] base legal dos artigos 7º ou 11 da LGPD registrada pelo controlador;
- [ ] finalidade, duração, frequência e categorias de titulares e dados;
- [ ] dado sensível e dado de criança tratados expressamente;
- [ ] países, subprocessadores e medidas técnicas/organizacionais;
- [ ] retorno, exclusão, incidente, auditoria e atendimento a titular;
- [ ] transparência pública em português;
- [ ] disponibilização das cláusulas ao titular no prazo regulamentar;
- [ ] assinatura de exportador e importador;
- [ ] parecer sobre a compatibilidade com a regra de região única do ADR-012.
