# ADR-012: Estabelecer retenção, legal hold e a postura de LGPD

- **Status:** Aceito — decidido pela sociedade em 2026-08-07
- **Data:** 2026-08-05
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** entrada de dado real em produção; todo contrato comercial com escritório
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Decisão (2026-08-07)

Aceito o **padrão conservador integral**: preservar por padrão, nenhum expurgo automático, legal hold em nível de caso falhando fechado, exclusão lógica como única exclusão do MVP, região única sem cópias fora dela, lista de suboperadores publicada antes do primeiro provedor real, e nenhum fornecedor que treine com conteúdo enviado, a qualquer preço. Nenhuma alegação de conformidade LGPD antes de os procedimentos existirem.

## Contexto

O `README.md` lista retenção de objetos em produção, legal hold, backup e restauração, e expurgo irreversível como bloqueadores de governança. O `docs/product/mvp-scope.md` se recusa a alegar conformidade com a LGPD antes de essas políticas existirem. A proposta conceitual não menciona proteção de dados em momento algum.

Esse silêncio é um problema comercial antes de ser técnico. O encarregado de dados de um escritório vai pedir contrato de tratamento de dados, base legal por categoria, lista de suboperadores, tabela de retenção e procedimento de exclusão antes de assinar. Nenhum desses documentos existe.

Três características tornam isso mais difícil que proteção de dados de SaaS comum:

1. **O escritório trata dados de pessoas que não são clientes dele.** Partes contrárias, testemunhas e terceiros aparecem nos documentos do caso e nunca consentiram com nada. Um pedido de exclusão vindo de uma parte contrária não pode ser simplesmente atendido — o escritório detém o material para exercer ou defender direito em processo —, mas o pedido ainda precisa ser respondido corretamente.
2. **Documentos são prova.** Apagar um arquivo pode destruir algo de que um processo depende. Retenção aqui não é questão de custo de armazenamento.
3. **Todo provedor de IA é suboperador.** No momento em que conteúdo de documento é enviado a um fornecedor de OCR, transcrição ou modelo de linguagem, esse fornecedor trata dados pessoais dos clientes do escritório. Isso precisa ser divulgado, coberto em contrato e mantido atualizado. Acopla diretamente ao ADR-011: um fornecedor que treina com o conteúdo enviado não é selecionável a preço nenhum.

O sistema já faz as coisas certas estruturalmente — exclusão lógica, auditoria append-only, originais imutáveis, reconciliação que reporta em vez de apagar. O que falta é a política que diz a esses mecanismos quando agir.

## Decisões necessárias

1. **Base legal** por categoria de dado — dados de cliente, de parte contrária, de terceiro e de usuário do escritório.
2. **Tabela de retenção**, e se alguma exclusão chega a ser automática.
3. **Mecanismo de legal hold** — como um caso é marcado de modo que nada dentro dele possa ser expurgado por ninguém, inclusive por administrador.
4. **Procedimento de atendimento a titular**, incluindo a resposta quando o titular é a parte contrária.
5. **Divulgação de suboperadores** — lista pública e versionada, e o processo de notificação quando ela mudar.
6. **Residência dos dados** — uma região documentada, e se cópias em outra região são permitidas em algum ponto, inclusive backups.
7. **Encerramento** — o que acontece com os dados de um escritório quando ele deixa de ser cliente, e como são exportados.

## Padrão conservador recomendado

Adotar a posição mais restritiva que ainda seja operável, e afrouxar depois com evidência:

- **Preservar por padrão. Nenhum expurgo automático, de espécie alguma.** Exclusão é sempre ação explícita, autorizada e auditada.
- **Legal hold é uma marca no caso que bloqueia todo caminho de exclusão**, inclusive administrativos e inclusive a ferramenta de reconciliação. Falha fechada: se o estado de hold não puder ser determinado, a exclusão é recusada.
- **Exclusão lógica é a única exclusão no MVP.** Expurgo irreversível é capacidade separada, posterior e deliberadamente construída, com revisão própria.
- **Uma região documentada. Nenhuma cópia em outra região, inclusive backups.**
- **A lista de suboperadores é publicada e versionada antes de o primeiro provedor real ser ligado**, não depois.
- **Nenhum fornecedor que treine com o conteúdo enviado é elegível**, independentemente do preço. Isso restringe o ADR-011.
- **Não fazer nenhuma alegação de conformidade com a LGPD em material de marketing ou comercial** enquanto não existirem tabela de retenção, procedimento de exclusão, registro de base legal e contrato de tratamento. O `mvp-scope.md` já proíbe isso; precisa valer também fora dos documentos de engenharia.

## Consequências

### Positivas

- o padrão conservador não consegue destruir prova, que é a falha impossível de desfazer;
- legal hold que falha fechado é coerente com a postura já adotada para verificação de vírus e isolamento entre clientes;
- ter a lista de suboperadores e o contrato de tratamento prontos remove o bloqueio mais comum numa contratação por escritório.

### Negativas

- preservar tudo faz o custo de armazenamento crescer sem limite e adia a conversa real de retenção em vez de resolvê-la;
- "nenhum expurgo automático" é, ele próprio, uma posição que um encarregado pode contestar, já que retenção indefinida exige justificativa sob a LGPD;
- excluir fornecedores que treinam com o conteúdo enviado estreita o campo e pode elevar o custo unitário;
- região única sem cópia de backup em outra região reduz opções de recuperação de desastre e exige aceite explícito de risco.

## Alternativas rejeitadas

- **Adiar tudo isso até um cliente perguntar:** a primeira conversa comercial é exatamente quando se pergunta, e chegar sem resposta custa o contrato.
- **Exclusão automática por tempo de retenção no MVP:** a operação irreversível de maior consequência, construída antes da política que a governa.
- **Tratar provedores de IA como ferramentas e não como suboperadores:** juridicamente errado, e é o tipo de erro que aparece em auditoria.
- **Atender automaticamente pedidos de exclusão de parte contrária:** destruiria material que o escritório detém para exercer ou defender direito em processo.
- **Alegar conformidade com a LGPD porque o sistema tem log de auditoria e criptografia:** conformidade é um conjunto documentado de procedimentos, não uma lista de funcionalidades.

## Verificações de conformidade

- Nenhum caminho de exclusão consegue remover dado de um caso sob legal hold, e a verificação falha fechada.
- Toda exclusão, exportação e mudança de hold é auditada com autor e horário.
- A lista de suboperadores é versionada no repositório e corresponde aos provedores efetivamente ligados.
- Backups não saem da região documentada.
- Nenhum documento comercial ou de marketing afirma conformidade com a LGPD sem os procedimentos por trás.
- O atendimento a titular é um procedimento documentado com responsável nomeado, não uma tarefa avulsa de engenharia.

## Necessário antes de

Qualquer dado real de cliente entrar no sistema, qualquer provedor de IA real ser ligado, e qualquer contrato comercial ser assinado.
