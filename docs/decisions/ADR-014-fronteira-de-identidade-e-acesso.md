# ADR-014: Fronteira de identidade e acesso

- **Status:** Proposto — aguarda decisão da sociedade
- **Data:** 2026-08-20
- **Decisores:** sócios da SAMUEL DEV LTDA
- **Trava:** o que um escritório consegue fazer sozinho com as próprias pessoas
- **Idioma:** pt-BR, por ser documento de decisão para a sociedade e não documentação técnica

## Por que este registro existe

A Entrega 12 dá ao escritório o mínimo para operar as próprias pessoas: entrar por um nome
legível, convidar, atribuir papel, bloquear. Para caber num incremento revisável, ela deixa
**oito coisas na mesa**. Nenhuma é esquecimento; cada uma é uma escolha com consequência.

Este registro existe para que elas parem de ser invisíveis. Lacuna que ninguém escreveu vira
descoberta em reunião com cliente.

## O que a Entrega 12 resolve

Vale separar, porque duas dessas pareciam pendência e não são.

**Bloqueio e troca de papel valem na requisição seguinte.** O guard de acesso reconsulta
status, exclusão, papéis e permissões no banco a cada chamada — ele não confia no que está
escrito no token. Bloquear alguém não deixa uma janela aberta até o token expirar. A revogação
das sessões de atualização, feita na mesma transação do bloqueio, fecha também o caminho de
renovação.

**Escritório inexistente não se distingue de senha errada.** Trocar o UUID por um nome legível
tornou o identificador adivinhável, e as três defesas estão descritas no
[API de autenticação](../api/authentication.md).

## As oito pendências

Cada uma traz o que destrava — e o custo de deixar como está.

### 1. Quem esquece a senha não tem caminho

Hoje só um administrador consegue resolver, refazendo o convite. Numa banca com quarenta
advogados isso vira chamado semanal para o sócio que tiver o acesso.

**Destrava com:** o adapter de e-mail do [ADR-013](./ADR-013-notificacoes-internas.md). A
recuperação é o mesmo mecanismo do convite — token de uso único, com validade, guardado em
hash — apontando para uma pessoa que já está ativa. O que falta é o canal, não a mecânica.

### 2. O convite viaja fora do sistema

Sem adapter de e-mail, a rota de convite devolve o token **uma única vez**, na resposta, para
o administrador entregar à pessoa por um canal que ele escolhe. O token nunca é registrado em
log nem em auditoria, e não há segunda chance de lê-lo: quem perder, revoga e convida de novo.

É honesto e funciona, mas transfere a segurança do elo final para o hábito de quem opera. Um
token colado em grupo de mensagens é um acesso ao acervo do escritório.

**Destrava com:** o mesmo adapter do item 1. Enquanto isso, a tela precisa dizer isso com todas
as letras a quem copia o link.

### 3. Não há segundo fator

Um acervo jurídico inteiro protegido por uma senha. Para o público que o produto persegue —
bancas estabelecidas, com dado sensível de cliente — isso aparece na primeira due diligence de
segurança.

**Destrava com:** decisão da sociedade sobre TOTP próprio ou delegar a um provedor de
identidade (item 4). São caminhos diferentes e escolher um descarta o outro por um bom tempo.

### 4. Não há entrada federada

Bancas grandes usam Microsoft 365 ou Google Workspace e vão pedir para entrar com a conta
corporativa. É requisito de compra, não conforto.

**Destrava com:** decisão da sociedade. Tem peso comercial e arquitetural: uma pessoa passa a
existir no provedor de identidade, e o papel dela pode vir de um grupo de lá em vez do nosso
`UserRole`.

### 5. O escritório não se cadastra sozinho

Criar uma organização é operação interna nossa. Para venda assistida está correto e evita o
tenant-lixo criado por curiosidade. Vira gargalo no dia em que houver autoatendimento ou teste
gratuito.

**Destrava com:** decisão comercial, não técnica.

### 6. O nome curto do escritório não muda

O `slug` é imutável por escolha: ele circula em link de convite e entra no hábito de quem digita
todo dia. Um escritório que se renomeia — fusão, saída de sócio — fica com o nome antigo na
tela de entrada.

**Destrava com:** decidir entre nunca mudar, mudar com o antigo redirecionando por um prazo, ou
mudar quebrando os links. A intermediária exige guardar o histórico de nomes e é a única que não
machuca ninguém.

### 7. Uma pessoa só existe em um escritório

O modelo permite o mesmo e-mail em organizações diferentes, mas seriam duas pessoas distintas,
com senhas distintas. O advogado que atua em duas bancas mantém dois acessos.

**Destrava com:** decisão de produto. É raro no público-alvo e o custo de suportar é alto:
atravessa sessão, auditoria e todo o isolamento por tenant. Registrado para ser recusado
conscientemente, não por omissão.

### 8. O último administrador pode se trancar do lado de fora

Sem regra, alguém remove o próprio papel administrativo e o escritório fica sem ninguém que
possa convidar ou atribuir. A Entrega 12 impede isso: uma pessoa não remove o próprio último
acesso administrativo. Fica em aberto o caso mais feio — o **único** administrador que é
bloqueado ou desligado por outra via.

**Destrava com:** decisão sobre quem socorre. As opções são exigir sempre dois administrativos
ativos, ou aceitar que o desbloqueio seja procedimento nosso de suporte, com registro.

## Recomendação

Em ordem, e a ordem importa:

1. **Adapter de e-mail** ([ADR-013](./ADR-013-notificacoes-internas.md)) — resolve os itens 1 e
   2 de uma vez e é o único que hoje transfere risco para fora do sistema.
2. **Segundo fator** (item 3) — o primeiro que aparece em due diligence.
3. **Entrada federada** (item 4) — quando houver a primeira banca grande no funil.

Os itens 5, 6 e 7 podem esperar sem custo. O item 8 precisa de uma frase de decisão, não de
código.

## Consequências de não decidir

Os itens 1 e 2 seguem operando: convite por link entregue à mão e senha esquecida resolvida por
administrador. Funciona em escritório pequeno e degrada com o tamanho do cliente — exatamente ao
contrário do que a estratégia comercial persegue.

Nenhum destes itens bloqueia dado real de cliente. Esse bloqueio continua sendo do
[ADR-012](./ADR-012-retention-legal-hold-lgpd.md).
