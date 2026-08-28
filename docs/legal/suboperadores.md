# Lista de suboperadores

- **Versão:** 2 · **Vigente desde:** 2026-08-28
- **Exigida por:** ADR-012
- **Escopo:** fornecedores que efetivamente hospedam ou recebem dados da instalação do LEX OS.

Esta lista descreve o que está ligado, não o que se pretende contratar. Serviço configurado no
repositório, mas sem implantação comprovada, não entra como suboperador ativo.

---

## 1. Suboperadores em uso

| #   | Suboperador         | Serviço                                                              | O que ele alcança                                                                                           | Localização comprovada ou declarada                                                                                | Uso permitido hoje                  |
| --- | ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | Railway Corporation | API, worker, PostgreSQL, Redis, MinIO e interface web de homologação | Todo o acervo hospedado: originais, derivados, pessoas, casos, auditoria e filas                            | Réplicas e volumes em Amsterdam, Países Baixos (`europe-west4-drams3a`); o DPA declara operações primárias nos EUA | Somente acervo fictício             |
| 2   | Anthropic, PBC      | API de modelo de linguagem para respostas fundamentadas              | Pergunta e até cinco trechos autorizados recuperados do caso; nunca recebe arquivo inteiro por este caminho | Armazenamento declarado nos EUA e processamento que pode ocorrer nos EUA, Europa, Ásia e Austrália                 | Somente acervo fictício, por código |

Verificação operacional feita em 2026-08-28 nos ambientes `staging` e `production` da Railway:

- API, worker, PostgreSQL, Redis e MinIO têm uma réplica em `europe-west4-drams3a`;
- a interface web existe na Railway em `staging`; não há serviço `web` ativo em `production`;
- API e worker declaram `CASE_ARCHIVE=fictional`, `AI_LANGUAGE_MODEL_PROVIDER=anthropic` e
  `AI_LANGUAGE_MODEL_NAME=claude-sonnet-5` nos dois ambientes;
- o SMTP aponta para `127.0.0.1:1025`; não há relay de e-mail externo de produção;
- a conta Vercel conectada nesta máquina não contém projeto, e o GitHub não registra deployment
  da Vercel. O arquivo `apps/web/vercel.json` é configuração possível, não prova de uso. Por isso
  a Vercel saiu da lista ativa nesta versão.

O uso de Anthropic sobre fixture fictícia não transforma o conteúdo em dado de cliente, mas a
integração precisa constar porque está ligada e porque sua habilitação sobre acervo real é um
portão separado.

## 2. Residência e transferência internacional

O ADR-012 exige uma região documentada e nenhuma cópia em outra região, inclusive backup. A
seleção de Amsterdam na Railway prova onde as réplicas e os volumes do projeto rodam; ela **não
prova** que toda operação de suporte, telemetria, backup ou subcontratação permaneça nessa região.

Há duas incompatibilidades abertas com a redação atual do ADR:

1. o DPA público da Railway informa operações primárias nos Estados Unidos e descreve backups
   entre múltiplos locais e regiões;
2. a Anthropic informa armazenamento nos Estados Unidos e roteamento padrão por múltiplas regiões.

Assim, cláusulas-padrão da ANPD são necessárias para a transferência internacional, mas **não
bastam** para satisfazer a regra interna de região única. Antes de acervo real, a sociedade deve
escolher e registrar uma das duas rotas:

- contratar compromissos específicos dos fornecedores que limitem armazenamento, cópias,
  processamento e backups a uma única região documentada; ou
- aprovar um novo ADR que substitua conscientemente a regra de região única por uma política de
  transferências autorizadas, com países, subprocessadores, retenção e salvaguardas registrados.

Até uma dessas rotas ser executada, `CASE_ARCHIVE=fictional` continua obrigatório.

## 3. Fornecedor de IA

Os [Termos Comerciais da Anthropic](https://www.anthropic.com/legal/commercial-terms) dizem que a
Anthropic não pode treinar modelos com o conteúdo do cliente. A regra material de não treinamento,
portanto, existe no contrato padrão. Isso só vale como evidência do LEX OS quando:

1. a organização comercial da Anthropic estiver em nome da **SAMUEL DEV LTDA**;
2. um representante com poderes aceitar os Termos Comerciais e o DPA pela empresa;
3. a adesão ao _Development Partner Program_ permanecer desativada;
4. a organização, a data de aceite e as versões dos termos forem guardadas no dossiê contratual.

A chave de API não prova quem contratou nem quem tinha poderes para aceitar os termos. Ela é
segredo operacional e nunca entra no repositório.

A retenção padrão publicada para a API é de até 30 dias, com exceções de política de uso e
obrigação legal. Retenção zero depende de acordo e de modelo elegível. Mesmo com retenção zero, a
localização padrão descrita pelo fornecedor permanece incompatível com a regra de região única
enquanto não houver acordo específico ou novo ADR.

## 4. Como esta lista muda

Suboperador novo entra aqui **antes** de ser ligado. Cada mudança:

1. sobe a versão no topo;
2. registra ambiente, finalidade, categorias de dados, países e retenção;
3. anexa ou referencia o contrato de tratamento e o mecanismo de transferência aplicável;
4. é comunicada aos controladores no prazo contratual;
5. mantém o histórico anterior no Git.

## 5. Fontes verificadas

- [Railway — Regions](https://docs.railway.com/deployments/regions)
- [Railway — Data Processing Addendum](https://railway.com/legal/dpa)
- [Railway — Backups](https://docs.railway.com/volumes/backups)
- [Anthropic — Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- [Anthropic — Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum)
- [Anthropic — localização de processamento e armazenamento](https://privacy.claude.com/pt/articles/7996890-onde-seus-servidores-estao-localizados-voce-hospeda-seus-modelos-na-ue)
- [Anthropic — retenção da API](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)

## 6. Histórico

| Versão | Data       | Mudança                                                                                                                                    |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2      | 2026-08-28 | Inventário conferido; Railway corrigida para Amsterdam; Anthropic incluída; Vercel sem uso comprovado removida; conflito regional exposto. |
| 1      | 2026-08-27 | Primeira versão, então registrando Railway e Vercel e nenhum provedor de IA.                                                               |
