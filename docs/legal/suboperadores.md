# Lista de suboperadores

- **Versão:** 1 · **Vigente desde:** 2026-08-27
- **Operador:** SAMUEL DEV LTDA, na condição de operadora dos dados tratados por conta do
  escritório contratante, que é o controlador.
- **Exigida por:** ADR-012, que condiciona o primeiro provedor real de IA à existência desta
  lista, versionada e publicada **antes** — não depois.

Suboperador é todo terceiro que trata dados pessoais por nossa conta. Estar nesta lista não é
demérito: é o que permite ao encarregado de dados do escritório saber por onde o acervo dele
passa. O que seria grave é um suboperador **fora** dela.

---

## 1. Suboperadores em uso

| #   | Suboperador         | Serviço                                                                      | O que ele alcança                                                                                             | País do tratamento |
| --- | ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Railway Corporation | Hospedagem da aplicação, banco PostgreSQL, Redis e armazenamento de objetos  | **Todo o conteúdo**: documentos originais, texto extraído, dados de pessoas e casos, e-mails na fila de saída | Estados Unidos     |
| 2   | Vercel Inc.         | Hospedagem da interface web (arquivos estáticos e proxy das chamadas de API) | Não armazena conteúdo. Os dados atravessam o proxy em trânsito, cifrados                                      | Estados Unidos     |

**Nenhum outro.** Em especial, e por decisão registrada:

- **Nenhum provedor de modelo de linguagem, OCR ou embeddings.** Todos são simulações
  determinísticas que rodam dentro da própria aplicação e não fazem chamada externa. O primeiro
  provedor real depende desta lista ser atualizada antes de ser ligado.
- **Nenhum serviço de antivírus externo.** A verificação de arquivos é interna.
- **Nenhum relay de e-mail de produção.** O adaptador de e-mail existe e, fora de
  desenvolvimento, recusa subir sem um servidor configurado. Quando um for contratado, entra
  nesta lista antes de ser ligado.
- **Nenhuma ferramenta de análise, telemetria de produto ou rastreamento na interface.**

## 2. Residência dos dados

O ADR-012 exige **uma região documentada, sem cópias em outra região, inclusive backups**.

Hoje a instalação demonstrativa roda em região dos Estados Unidos na Railway. **Isso é adequado
para material fictício e não é adequado para acervo de cliente brasileiro** sem que o escritório
contratante seja informado e concorde, por escrito, com a transferência internacional — e sem que
a base legal dessa transferência esteja no contrato de tratamento.

Esta é uma pendência aberta, não uma conformidade alcançada. Ela está registrada em
[`termos-de-tratamento.md`](./termos-de-tratamento.md), seção 6.

## 3. A regra que restringe a escolha do provedor de IA

Do ADR-012, e ela não é negociável por preço:

> **Nenhum fornecedor que treine com o conteúdo enviado é elegível**, independentemente do preço.

Antes de qualquer provedor entrar nesta lista, três coisas precisam estar por escrito e guardadas:

1. Que o conteúdo enviado **não é usado para treinar** modelo nenhum, do fornecedor ou de
   terceiro.
2. **Por quanto tempo** o fornecedor retém o conteúdo enviado, e se há retenção zero disponível.
3. Em **que país** o tratamento ocorre, e quais suboperadores o próprio fornecedor usa.

A declaração pública do fornecedor não basta: é preciso a cláusula contratual ou o adendo de
tratamento de dados assinado, guardado junto a este documento.

## 4. Como esta lista muda

Suboperador novo **entra aqui antes de ser ligado**, nunca depois. A ordem importa: uma lista
atualizada depois do fato documenta um vazamento de escopo em vez de preveni-lo.

Cada alteração sobe a versão no topo, mantém a anterior no histórico do Git, e é comunicada aos
escritórios contratantes com antecedência razoável antes de entrar em vigor — prazo que o
contrato de tratamento fixa.

## 5. Histórico

| Versão | Data       | Mudança                                                                                       |
| ------ | ---------- | --------------------------------------------------------------------------------------------- |
| 1      | 2026-08-27 | Primeira versão. Railway e Vercel. Nenhum provedor de IA, nenhum relay de e-mail de produção. |
