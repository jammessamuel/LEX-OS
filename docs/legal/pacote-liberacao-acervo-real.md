# Pacote de liberação de acervo real

- **Versão:** 1 · **Data:** 2026-08-28
- **Responsável técnico:** SAMUEL DEV LTDA
- **Estado:** preparação concluída; liberação bloqueada até os atos externos abaixo
- **Regra:** nenhum item é marcado concluído por declaração verbal, variável de ambiente ou chave
  de API. A evidência precisa identificar parte, versão, data e signatário.

Este pacote transforma quatro pendências genéricas em atos verificáveis. Ele não substitui
advogado, assinatura da contraparte nem consentimento da pessoa nomeada. Documentos assinados não
devem ser publicados no Git; o repositório guarda apenas o registro sem segredo e a identificação
da evidência mantida no arquivo societário.

---

## 1. Decisão operacional

`CASE_ARCHIVE=fictional` permanece em todos os ambientes. A troca para `real` só pode entrar em
uma entrega própria depois de todos os portões estarem concluídos e revisados em conjunto.

| #   | Portão                                | O que já está resolvido                                                                            | Ato que ainda produz efeito jurídico                                        |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Fornecedor não treina com o conteúdo  | Termos Comerciais da Anthropic contêm a proibição; integração continua limitada a fixture fictícia | Aceite e DPA pela SAMUEL DEV LTDA, com prova da organização e do signatário |
| 2   | Transferência internacional           | Países e fluxos atuais foram inventariados; modelo da ANPD foi escolhido                           | Cláusulas brasileiras assinadas por cada importador e decisão sobre região  |
| 3   | Atendimento a titular                 | Fluxo e minuta de nomeação estão prontos                                                           | Pessoa aceita, sociedade assina e canal público passa a existir             |
| 4   | Revisão dos 15 prompts especializados | Mecanismo técnico e termo de atestação estão prontos; código volta a dizer `DRAFT`                 | Advogado com OAB ativa lê e assina as versões listadas                      |

## 2. Portão 1 — fornecedor de IA

### Escolha

Manter a Anthropic como candidata, porque os termos comerciais já proíbem treinamento com
conteúdo do cliente. Não usar conta pessoal de sócio como prova contratual da empresa.

### Execução

1. Criar ou transferir uma organização comercial da Anthropic para **SAMUEL DEV LTDA**.
2. Tornar um representante com poderes o _Primary Owner_ e responsável pelo faturamento.
3. Esse representante aceita os
   [Termos Comerciais](https://www.anthropic.com/legal/commercial-terms) e o
   [DPA](https://www.anthropic.com/legal/data-processing-addendum) pela empresa.
4. Confirmar em `Settings > Privacy Controls` que o _Development Partner Program_ está
   desativado.
5. Registrar a retenção aplicável. O padrão publicado da API é até 30 dias; solicitar retenção
   zero para endpoints e modelos elegíveis, sem presumir que o pedido foi aceito.
6. Guardar no arquivo societário a confirmação de aceite, organização, data, termos vigentes,
   retenção e configuração de compartilhamento.

### Registro sem segredo

| Campo                           | Valor a registrar |
| ------------------------------- | ----------------- |
| Organização comercial           |                   |
| Identificador da organização    |                   |
| Titular da cobrança             |                   |
| Representante que aceitou       |                   |
| Data/hora do aceite             |                   |
| Versão ou vigência dos termos   |                   |
| DPA executado                   |                   |
| Retenção efetiva                |                   |
| _Development Partner Program_   |                   |
| Referência interna da evidência |                   |

**Resultado atual:** o texto de não treinamento foi verificado, mas uma chave de API não prova
que a SAMUEL DEV LTDA é a parte contratante. Acervo real continua bloqueado.

## 3. Portão 2 — transferência internacional e região

### Escolha

Usar as cláusulas-padrão do Anexo II da Resolução CD/ANPD nº 19/2024, integralmente e sem alterar
o texto obrigatório. Consentimento genérico do escritório não é a solução: a cadeia inclui
titulares que nunca consentiram.

Use a [folha de montagem do instrumento](./modelos/folha-transferencia-internacional.md) para
Railway e Anthropic. O jurídico deve anexar o texto oficial da resolução ao DPA de cada fornecedor
e obter aceite da contraparte.

### Conflito que precisa de decisão

A regra de região única do ADR-012 é mais restritiva que os contratos padrão encontrados:

- Railway: workload e volumes do projeto estão em Amsterdam, mas o DPA declara operações
  primárias nos EUA e backups em múltiplos locais/regiões;
- Anthropic: armazenamento nos EUA e processamento padrão em mais de uma geografia.

Por isso, a assinatura das cláusulas da ANPD é necessária, mas não fecha o ADR sozinha. A opção
preferida é obter compromisso contratual de uma única região. Se os fornecedores não oferecerem,
a sociedade deve escolher entre migrar a infraestrutura ou aprovar novo ADR, com parecer jurídico,
substituindo conscientemente a regra de região única. Engenharia não marca nenhuma opção por conta
própria.

## 4. Portão 3 — responsável por titulares

### Escolha

Nomear uma pessoa física como responsável interina de privacidade, com canal funcional e
substituto. A indicação recomendada para deliberação é **Samuel James Sousa Barreto**, porque já
figura como decisor da empresa no ADR-016. Isso é proposta, não nomeação automática.

Passos:

1. a pessoa indicada aceita a função;
2. a sociedade completa e assina a
   [minuta de nomeação](./modelos/ato-nomeacao-responsavel-privacidade.md);
3. a empresa cria um endereço funcional, por exemplo `privacidade@<domínio-da-empresa>`, sem usar
   e-mail pessoal;
4. nome e contato são publicados no site/aviso de privacidade;
5. o canal é testado e passa a ter registro de protocolo, identidade, controlador e prazo.

Sem domínio e e-mail público confirmados, este portão não pode ser marcado concluído.

## 5. Portão 4 — revisão jurídica dos prompts

Os quinze prompts de Trabalhista, Cível e Criminal ficam `DRAFT`. A leitura preliminar anterior,
feita por profissional sem inscrição ativa, é preservada como contribuição, mas não atende à
condição do ADR-015.

Um advogado com inscrição ativa deve ler, para cada faixa:

- o texto dos cinco prompts;
- os contratos de entrada e saída correspondentes;
- o caderno de pesquisa e os achados adversariais;
- as limitações declaradas e as citações normativas.

A promoção pode ser assinada num único instrumento desde que identifique as quinze versões. Use o
[termo de atestação](./modelos/atestado-revisao-prompts.md). Depois da assinatura, uma mudança de
código separada registra nome, OAB, data e `reviewedVersion`; não se antecipa esse estado.

## 6. Regra de encerramento

O portão só fecha quando a revisão final conferir:

- identidade e poderes dos signatários;
- correspondência entre empresa, conta e faturamento;
- versões contratuais e versões dos prompts;
- países, retenção, subprocessadores e regra regional;
- funcionamento do canal de privacidade;
- ausência de segredo ou documento assinado no Git.

Depois disso, um novo ADR ou adendo ao ADR-012 registra a escolha regional e uma entrega própria
altera a trava de execução. Até lá, o sistema está correto ao recusar acervo real.
