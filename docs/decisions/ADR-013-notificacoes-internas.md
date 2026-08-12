# ADR-013: Notificações internas por e-mail

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-07
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** adapter de e-mail e qualquer aviso automático ao escritório
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Decisão (2026-08-07)

Aceita a **recomendação integral**: conteúdo mínimo sempre (código do caso, tipo do acontecimento, link — nada além), três gatilhos da primeira fase só para o responsável/atribuído, imediato para falha e tarefa com resumo diário para conclusões, opt-out por gatilho exceto falha, envio pelo worker com auditoria sem corpo, e provedor SMTP de produção somente com termos registrados.

## Contexto

O escritório só descobre que um preparo terminou, que um documento falhou ou que uma tarefa
foi atribuída se alguém abrir a tela. Para o advogado responsável, isso significa voltar ao
sistema "para ver se tem novidade" — exatamente o tipo de atrito operacional que o produto
promete eliminar.

A fundação já existe e foi verificada no código: o `AGENTS.md` previu adapter de e-mail
desde o início; o Mailpit já roda no Compose local; o worker é o lugar certo para enviar
(nenhum trabalho pesado em handler HTTP); `Task.assignedToId` e `User.email` já estão no
banco, então o destinatário se resolve no servidor **sem depender da rota de usuários que
ainda não existe**. Os três gatilhos têm ponto de encaixe exato: conclusão do preparo,
falha terminal de documento e criação de tarefa atribuída.

O que não existe é política. E o `mvp-scope.md` é silencioso sobre notificações, o que
pela regra da casa transforma a adição de escopo em decisão da sociedade.

Duas restrições não são negociáveis:

1. **E-mail é canal de saída.** O que sai do sistema deixa de estar protegido por ele.
2. **O provedor SMTP de produção vira suboperador** dos dados que transitarem no e-mail —
   acopla esta decisão ao ADR-012.

## Decisões necessárias

1. **Política de conteúdo.** O que um e-mail pode carregar.
2. **Gatilhos da primeira fase.** Quais eventos notificam, e quem.
3. **Cadência.** Imediato por evento, ou resumo agrupado.
4. **Opt-out.** Se o advogado pode silenciar, e o quê.
5. **Provedor SMTP de produção.** Com termos de tratamento de dados registrados.

## Recomendação

**Conteúdo mínimo, sempre.** O e-mail carrega apenas: código interno do caso, o tipo do
acontecimento em linguagem do usuário ("preparação concluída", "documento falhou",
"tarefa atribuída a você") e um link para a tela. **Nunca** título de documento, teor de
texto extraído, nome de parte, CPF/CNPJ ou mensagem de erro técnica. Quem clica no link
autentica e vê o resto dentro do sistema, onde tenant, permissão e confidencialidade
continuam valendo. Um e-mail interceptado revela que o caso X teve movimento — e nada mais.

**Primeira fase: os três gatilhos, só para o responsável.** Preparo concluído e documento
falhado vão ao responsável do caso; tarefa atribuída vai ao atribuído. Ninguém mais.
Caso confidencial não altera a regra porque o conteúdo mínimo já não revela nada — mas o
link exige a permissão de sempre.

**Imediato para falha e tarefa; resumo diário para conclusões.** Falha e atribuição pedem
ação; conclusão de preparo em lote viraria ruído se cada documento disparasse um e-mail.

**Opt-out por gatilho, exceto falha.** Falha de documento é o único aviso que não se
silencia: ignorá-la custa prazo processual.

**Envio pelo worker, com registro auditável.** O envio é um job como qualquer outro:
persistido, com retry limitado, e auditado (`SYSTEM` como ator) sem gravar o conteúdo —
apenas gatilho, destinatário e resultado.

## Consequências

### Positivas

- o padrão de conteúdo mínimo elimina a maior parte do risco LGPD do canal;
- a infraestrutura reaproveita o que existe: adapter previsto, worker, Mailpit no local;
- auditoria de envio dá resposta à pergunta "por que ninguém foi avisado?".

### Negativas

- e-mail de conteúdo mínimo obriga um clique a mais para ver o que houve;
- resumo diário atrasa a notícia boa (preparo pronto) em até um dia útil;
- provedor SMTP entra na lista de suboperadores e na diligência do ADR-012;
- caixa de entrada lotada é risco real: sem disciplina nos gatilhos, o escritório
  aprende a ignorar os avisos e o canal morre.

## Alternativas rejeitadas

- **Conteúdo rico no e-mail (título do documento, resumo do caso):** conveniente e
  indefensável no primeiro vazamento de caixa de entrada.
- **Notificar o cliente final:** fase futura explícita do pedido original; canal externo
  exige base legal própria e não entra antes do ADR-012 decidido.
- **WhatsApp como canal:** é o ADR-010, não este. Misturar as decisões atrasa as duas.
- **Enviar do handler HTTP:** viola a regra de nada pesado no request e perde retry.
- **Sem opt-out:** transforma o canal em spam institucional; a exceção única (falha) é
  deliberada e justificada por prazo.

## Verificações de conformidade

- Nenhum e-mail contém teor de documento, nome de parte, identificador pessoal ou stack
  técnico; um teste automatizado valida os templates contra a lista proibida.
- Todo envio gera registro de auditoria com ator `SYSTEM`, gatilho e destinatário — sem corpo.
- O adapter de e-mail vive em infraestrutura, atrás de contrato, como os demais.
- Falha de envio não derruba o job de negócio que a disparou.
- O provedor de produção só entra com termos de tratamento registrados (ADR-012).

## Necessário antes de

Qualquer código de envio de e-mail além do adapter local de desenvolvimento.
