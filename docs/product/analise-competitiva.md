# LEX OS contra o mercado

**Status:** Análise competitiva revisada após a implementação da Entrega 15

**Data-base:** 2026-08-24

**Base interna:** 20 concorrentes em três clusters, confrontados com as 65 operações HTTP
publicadas pelo LEX OS em produção

**Idioma:** pt-BR, por ser documento de decisão para a sociedade

Este documento orienta priorização. Ele não autoriza, sozinho, uma nova entrega. Afirmações
sobre concorrentes descrevem o material público consultado e não substituem demonstração,
contrato, teste do produto ou diligência jurídica.

---

## 1. Conclusão executiva

A tese do produto continua forte: sistemas de gestão dominam prazos, publicações, financeiro e
rotina do escritório; ferramentas de inteligência dominam bases públicas; o LEX OS organiza e
torna pesquisável o acervo privado do próprio escritório, com procedência e confirmação humana.

O levantamento original, porém, ficou desatualizado no mesmo dia em que foi escrito. A Entrega
15 implementou os três itens então recomendados:

- número CNJ, tribunal e órgão julgador no caso, com validação e busca;
- agenda operacional do escritório, com vencidos, hoje e janela futura;
- exportação assíncrona do dossiê em PDF, com cronologia confirmada, checklist e fontes.

O principal vazio de adoção passa a ser a **entrada automática de publicações e movimentações**.
Isso não deve ser confundido com cálculo automático e definitivo de prazo. Capturar um ato,
classificá-lo e sugerir uma tarefa são problemas diferentes de afirmar a data fatal de um prazo
processual.

### Recomendação

Adotar uma estratégia **provider-first, provider-agnostic**:

1. definir contratos próprios de comunicação e movimentação processual;
2. comparar o DJEN público com pelo menos dois provedores em um piloto de dados públicos e
   fictícios;
3. lançar o primeiro incremento com um provedor comercial, se cobertura, contrato, segurança e
   SLA forem aprovados;
4. manter o DJEN direto como fonte oficial de comparação e possível adapter alternativo, sem
   transformar sua API em dependência do domínio.

Essa estratégia reduz o tempo de entrada no mercado sem entregar o produto a um fornecedor.

---

## 2. Leitura do mercado

### Os três clusters

| Cluster                             | Exemplos examinados                                                             | O que dominam                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Gestão do escritório**            | Astrea, ADVBOX, Projuris, CPJ-3C, SAJ ADV, Legal One, Espaider, Easyjur, Benner | Prazos, publicações, andamentos, financeiro e rotina operacional        |
| **Inteligência sobre base pública** | Turivius, Jusbrasil Pro, Data Lawyer, Judit, Advise, Digesto                    | Jurisprudência, jurimetria, consulta e monitoramento de fontes públicas |
| **Referência internacional**        | Clio, Smokeball, Filevine, Harvey, CoCounsel                                    | Acabamento de produto, colaboração e experiência de IA                  |

A fronteira entre os clusters não é absoluta. Concorrentes adicionam recursos de IA e gestão
continuamente. A posição defensável do LEX OS não é simplesmente “ter IA”; é combinar acervo
privado, procedência resolvível, autorização por tenant, revisão humana e custo controlado.

### Diferenciais que já existem no LEX OS

| Capacidade                     | Situação verificável                                                        | Valor competitivo                                                    |
| ------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Procedência de dados extraídos | Arquivo, localização, extração, provedor/modelo e confiança são persistidos | Permite conferir a afirmação na evidência original                   |
| Busca no acervo autorizado     | Busca textual e semântica preserva escopo de tenant, caso e sigilo          | Pesquisa a memória privada do escritório, não somente bases públicas |
| Resposta ancorada              | Resultado sem citação autorizada é recusado                                 | Reduz o risco de resposta convincente sem evidência                  |
| Cronologia revisável           | Evento de IA nasce não confirmado e preserva a origem após confirmação      | Separa sugestão de máquina de validação profissional                 |
| Checklist documental           | Exigências e ausências permanecem ligadas às fontes e à revisão             | Converte material recebido em trabalho operacional                   |
| Segurança e auditoria          | Isolamento negativo, RBAC e auditoria mínima sem conteúdo jurídico          | Torna sigilo e rastreabilidade propriedades testáveis                |
| Controle de custo              | Execução medida e teto rígido por caso                                      | Evita custo de provedor sem limite conhecido                         |

Não se deve escrever “ninguém no mercado faz” sem uma matriz de evidências atualizada e teste de
cada produto. A formulação correta é: **não foi encontrada evidência pública equivalente, no
levantamento realizado, para a combinação completa dessas capacidades**.

---

## 3. Estado atual: de / para

### Já implementado após o levantamento original

| Capacidade                            | Estado atual     | Limite atual                                                          |
| ------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| Número CNJ, tribunal e órgão julgador | **Implementado** | Não consulta o tribunal automaticamente                               |
| Agenda de prazos                      | **Implementada** | Organiza vencimentos informados; ainda não calcula calendário forense |
| Exportação do dossiê                  | **Implementada** | Gera PDF assíncrono; envio externo e portal do cliente continuam fora |
| Interface móvel                       | **Responsiva**   | Ainda não é aplicativo nativo nem oferece push móvel                  |

### Lacunas que ainda travam adoção como sistema principal

| Capacidade               | Situação             | O que falta concretamente                                                                                                        |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Publicações e intimações | **Não implementada** | Monitorar OAB, nome, documento ou processo; deduplicar; vincular ao tenant e ao caso; preservar a fonte; permitir triagem humana |
| Andamentos automáticos   | **Não implementada** | Monitorar o CNJ, receber mudanças idempotentes e mostrar divergência entre fontes                                                |
| Prazos processuais       | **Parcial**          | Calendários por tribunal, suspensões, feriados locais, regra aplicável, explicação do cálculo e confirmação humana               |
| Notificação operacional  | **Parcial**          | Transformar um acontecimento confirmado em aviso mínimo conforme ADR-013                                                         |

### Capacidades futuras que não devem desviar a tese

| Capacidade                  | Direção recomendada                                                    |
| --------------------------- | ---------------------------------------------------------------------- |
| Portal do cliente           | Construir depois, com papel próprio e superfície de dados mínima       |
| Assinatura eletrônica       | Integrar por contrato; não criar infraestrutura criptográfica própria  |
| Modelos de peça             | Decisão societária anterior a código; nunca gerar sem fontes e revisão |
| Timesheet                   | Decidir se o LEX OS será sistema central ou integrará o ERP existente  |
| Financeiro                  | Integrar, não reconstruir um ERP financeiro                            |
| Jurisprudência e jurimetria | Integrar especialistas; não competir com bases consolidadas            |

---

## 4. DJEN direto versus provedor

O DJEN possui API pública oficial para consulta de comunicações. Isso torna tecnicamente possível
um adapter direto. A API pública também declara rate limit e possibilidade de bloqueio por uso
abusivo; ela não substitui, sozinha, fontes autenticadas dos tribunais nem oferece ao LEX OS um
SLA comercial.

Provedores comerciais oferecem cobertura ampliada, normalização, webhooks, monitoramento de
movimentações e suporte. Em troca, criam custo variável, dependência operacional e obrigações
contratuais sobre retenção, sigilo, credenciais, suboperadores e incidentes.

| Opção                                        | Pontos positivos                                                                                  | Pontos negativos                                                                                        | Uso recomendado                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **DJEN direto**                              | Fonte oficial; controle de ingestão; sem margem do intermediário; boa referência de reconciliação | Cobertura limitada ao que está no DJEN; rate limit; operação e deduplicação próprias; sem SLA comercial | Piloto, comparação de resultados e adapter alternativo |
| **Provedor comercial**                       | Entrada mais rápida; múltiplas fontes; webhooks; normalização; suporte e possíveis SLAs           | Custo; lock-in; cobertura variável; tratamento de dados e credenciais exige diligência                  | Primeiro conector de mercado, após bake-off e contrato |
| **Dois adapters em produção desde o início** | Redundância e comparação contínua                                                                 | Duplica integração, reconciliação e custo antes de validar demanda                                      | Não recomendado para o primeiro lançamento             |

### Critérios do bake-off

Pontuar cada opção sobre o mesmo conjunto de processos públicos e fictícios:

| Critério                                                         | Peso |
| ---------------------------------------------------------------- | ---: |
| Cobertura de DJEN, diários e sistemas eletrônicos                |  25% |
| Fidelidade, identificador de origem e possibilidade de auditoria |  20% |
| Contrato, sigilo, retenção, suboperadores e resposta a incidente |  20% |
| Disponibilidade, atraso, reenvio, reconciliação e suporte        |  15% |
| Qualidade da API, webhook, sandbox e idempotência                |  10% |
| Preço por termo, processo, consulta e excedente                  |  10% |

Eliminar, independentemente da nota, qualquer fornecedor que:

- use conteúdo do escritório para treinamento;
- não informe retenção e subprocessadores;
- não permita exclusão/revogação conforme o contrato e legal hold;
- exija segredo ou credencial sem cofre, rotação e trilha de acesso adequados;
- não ofereça identificador estável ou informação suficiente para deduplicação;
- não explique cobertura, atraso e comportamento durante indisponibilidade da fonte.

---

## 5. Próximo incremento proposto

Antes de autorizar produto novo, fechar duas pendências de qualidade e alinhamento:

1. corrigir a colisão do Playwright que gera o mesmo código de caso em execuções paralelas;
2. alinhar `AGENTS.md`, `CLAUDE.md`, `README.md`, quadro e plano de implementação sobre o último
   checkpoint aceito.

Depois disso, propor uma entrega curta de **descoberta e contrato de captura**, sem prometer ao
cliente cálculo automático de prazo.

### Escopo da descoberta

- contrato `CourtCommunicationProvider` para publicações e intimações;
- contrato separado `CourtMovementProvider` para movimentações processuais;
- payload de entrada versionado e tratado como dado hostil;
- identificador do fornecedor, identificador da fonte e fingerprint para deduplicação;
- vínculo explícito com organização e caso, sem aceitar `organization_id` do webhook;
- webhook autenticado, idempotente, com reenvio, dead letter e reconciliação;
- preservação do conteúdo original como artefato privado e derivação separada;
- auditoria sem copiar o conteúdo da publicação;
- triagem humana antes de criar prazo ou confirmar acontecimento;
- notificação com somente código do caso, tipo e link, conforme ADR-013;
- métricas de atraso, duplicidade, falso vínculo, falha e custo por fonte.

### Saídas necessárias para autorizar a implementação

1. matriz de cobertura e custos preenchida por pelo menos dois fornecedores;
2. parecer contratual sobre sigilo, retenção, treinamento e credenciais;
3. amostra comparativa DJEN versus fornecedores, somente com dados públicos/fictícios;
4. esquema e contratos revisados, sem SDK de fornecedor no domínio;
5. critérios de aceite para isolamento, autorização, idempotência, procedência e falha fechada;
6. decisão societária registrada: fornecedor inicial, teto de custo e cobertura prometida.

---

## 6. Fontes e limitações

### Fontes primárias consultadas

- [API pública do DJEN — CNJ](https://hcomunicaapi.cnj.jus.br/swagger/index.html)
- [Comunicações Processuais — CNJ](https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/)
- [API Pública do DataJud — CNJ](https://www.cnj.jus.br/sistemas/datajud/api-publica/)
- [JUDIT API — documentação oficial](https://docs.judit.io/introduction/introduction)
- [Digesto — monitoramento e webhooks](https://op.digesto.com.br/doc_api/monitoramento.html)
- [Advise — publicações, intimações, andamentos e integração](https://advise.com.br/)
- [ADVBOX — funcionamento de intimações](https://guia.advbox.com.br/menu-intimacoes/funcoes-menu-intimacoes)
- [Projuris ADV — termos e limites do monitoramento](https://www.projuris.com.br/termos-de-uso/adv/)

### Fontes secundárias usadas para descoberta do universo competitivo

- [SquadZ](https://asquadz.ai/blog/softwares-gestao-juridica-comparativo/)
- [iaLocus](https://ialocus.com.br/blog/post-sistema-advocacia-lgpd-cpj-astrea-projuris-2026.html)
- [Seasy](https://seasy.host/2026/04/02/advbox-vs-astrea-vs-projuris-adv-software-juridico-2026/)
- [Inspira](https://www.inspire-se.co/en/recursos/blog/players-legaltech-brasil-2026)

Materiais comerciais descrevem capacidades declaradas pelos próprios fornecedores. O estudo não
realizou contratação, teste de precisão, auditoria de segurança ou revisão dos contratos de todos
os vinte concorrentes. A contagem de 65 operações vem do OpenAPI publicado em produção na data-base.
