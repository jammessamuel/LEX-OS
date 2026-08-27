# Termos de tratamento de dados

- **Versão:** 1 · **Vigente desde:** 2026-08-27
- **Exigida por:** ADR-011, verificação 4 — os termos de tratamento precisam estar registrados
  antes do primeiro provedor real de IA.
- **Natureza deste documento:** registro técnico do que o sistema faz. **Não é o contrato.** O
  contrato de tratamento entre a SAMUEL DEV LTDA e cada escritório é peça jurídica separada, e
  este documento existe para que quem o redigir saiba o que está descrevendo.

---

## 1. Os papéis

O **escritório contratante é o controlador**: ele decide por que e como tratar o acervo dos casos
dele. A **SAMUEL DEV LTDA é operadora**: trata por conta do escritório, nos limites do que o
contrato disser, e não usa o conteúdo para finalidade própria.

Isso tem uma consequência que costuma passar batida: **a parte contrária de um processo é titular
de dados que estão no nosso sistema** e nunca contratou nada conosco. Pedido de titular vindo
dessa pessoa se responde na seção 5.

## 2. O que o sistema trata

| Categoria                | O que é                                                                  | De onde vem                                                 |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Identificação de pessoas | Nome, documentos de identificação, endereço, contato                     | Cadastro pelo escritório e extração de documentos enviados  |
| Conteúdo de processo     | Petições, decisões, contratos, comprovantes, laudos, mensagens           | Envio pelo escritório                                       |
| Texto extraído           | Transcrição do conteúdo dos arquivos, e trechos indexados para busca     | Gerado pelo sistema a partir do envio                       |
| Dados derivados          | Cronologia, entidades extraídas, classificação, análise de exigências    | Gerado pelo sistema, **sempre marcado como não confirmado** |
| Operacionais             | Contas de acesso, sessões, registro de auditoria, custo de processamento | Uso do sistema                                              |

O conteúdo de processo carrega, com frequência e sem que ninguém escolha, **dado pessoal sensível
na acepção da LGPD** — saúde em ação previdenciária ou de plano de saúde, filiação sindical em
reclamação trabalhista, dado de criança e adolescente em vara de família, condenação criminal.
Nenhuma triagem prévia disso é possível: o documento chega como chegou aos autos.

## 3. Base legal

A base legal é do **controlador**, não nossa, e o contrato deve declará-la. Na prática o que se
espera é o **exercício regular de direitos em processo** para o conteúdo de processo, e o
**cumprimento de obrigação legal** para a guarda documental do escritório.

Não declaramos base legal em nome do escritório, e nenhum documento comercial nosso deve dizer
que o produto "garante conformidade com a LGPD". Ele fornece controles; a conformidade é da
relação inteira, e depende do contrato, do procedimento e do uso.

## 4. Retenção e exclusão

Do ADR-012, e é postura deliberadamente conservadora:

- **Preservar por padrão.** Não há expurgo automático de nada.
- **Exclusão lógica é a única exclusão.** O registro sai das listas e permanece recuperável e
  auditável. Expurgo irreversível é capacidade separada, que ainda não existe.
- **Retenção obrigatória (_legal hold_)** é uma marca no caso que bloqueia todo caminho de
  exclusão, inclusive administrativo, e **falha fechada**: quando o estado da retenção não pode
  ser determinado, a exclusão é recusada. Implementada em 2026-08-27.
- **Toda exclusão e toda mudança de retenção é auditada** com autor, horário e motivo.

## 5. Pedido de titular

| Situação                        | Quem responde                          | Como                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titular é cliente do escritório | O escritório, como controlador         | Nós damos suporte técnico: exportação e localização do dado                                                                                                                              |
| Titular é a parte contrária     | O escritório, como controlador         | O acervo é peça de processo; a exclusão a pedido colide com o exercício regular de direitos e com a retenção obrigatória. A recusa precisa ser fundamentada pelo escritório, não por nós |
| Pedido chega diretamente a nós  | Encaminhamos ao escritório controlador | Não atendemos pedido de titular sobre acervo de cliente por conta própria                                                                                                                |

**Responsável nomeado:** a definir pela sociedade. Enquanto não houver nome, este procedimento
está incompleto — o ADR-012 exige responsável nomeado, e não uma tarefa avulsa de engenharia.

## 6. Transferência internacional — **pendência aberta**

A instalação demonstrativa roda em região dos Estados Unidos
([`suboperadores.md`](./suboperadores.md), seção 2).

Para material fictício isso não é problema. **Para acervo de cliente é**, e resolvê-lo exige uma
das duas: hospedagem em região brasileira, ou transferência internacional informada e consentida
no contrato, com a base legal correspondente declarada.

Nenhuma das duas está feita. Enquanto não estiver, **o sistema não deve receber acervo real de
cliente**, e a variável `CASE_ARCHIVE` de cada instalação deve continuar em `fictional`.

## 7. O que falta para o primeiro provedor real de IA

Estes termos são um dos portões. Os demais, do ADR-011 e do ADR-012:

- [x] Lista de suboperadores versionada — [`suboperadores.md`](./suboperadores.md)
- [x] Termos de tratamento registrados — este documento
- [x] Retenção obrigatória implementada e falhando fechada
- [x] Custo consultável por organização, provedor e modelo — `GET /processing-costs`
- [x] Custo do assistente debitando o orçamento do caso
- [ ] Cláusula assinada de que o fornecedor **não treina** com o conteúdo enviado
- [ ] Retenção do fornecedor conhecida e registrada
- [ ] Responsável nomeado pelo atendimento a titular
- [ ] Transferência internacional resolvida (seção 6)

## 8. Histórico

| Versão | Data       | Mudança                                                               |
| ------ | ---------- | --------------------------------------------------------------------- |
| 1      | 2026-08-27 | Primeira versão, registrando o que o sistema faz e o que ainda falta. |
