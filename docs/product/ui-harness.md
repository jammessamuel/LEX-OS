# Harness de interface

**Status:** Fonte da verdade para construir uma tela
**Última atualização:** 2026-08-20

Este arquivo existe para que criar uma tela **não exija abrir `tokens.css`, `styles.css`,
`patterns.css` nem uma view de exemplo**. Tudo que se repete está catalogado aqui.

`design-principles.md` diz _por que_ a interface é assim e é a autoridade estética.
Este arquivo diz _com o quê_ construir. Se os dois divergirem, o outro vence e este se corrige.

---

## 1. Antes de escrever markup

Responda três perguntas. Elas determinam a tela inteira.

1. **Qual pergunta o advogado traz ao abrir isto?** A resposta vira o veredito no topo, em
   uma frase, antes de qualquer lista. "3 exigências obrigatórias em falta", não uma tabela
   para ele contar.
2. **O que a tela ainda não faz?** Diga com todas as letras em uma `.note`. Botão que não
   funciona destrói a confiança na tela inteira; ausência declarada, não.
3. **Quais são os quatro estados?** Carregando, vazio, erro e conteúdo. Nenhum é opcional, e
   o vazio nunca é uma lista em branco: ele explica o que apareceria ali e oferece a saída.

---

## 2. Tokens

Nunca escreva um valor cru. Se falta um token, discuta antes de inventar.

| Grupo    | Tokens                                                                                    |
| -------- | ----------------------------------------------------------------------------------------- |
| Tinta    | `--ink` `--ink-strong` `--ink-soft` `--on-ink`                                            |
| Fundo    | `--paper` `--surface` `--surface-sunk` `--surface-raised`                                 |
| Traço    | `--line` `--line-strong` `--focus` `--shadow`                                             |
| Texto    | `--text` `--text-2` `--text-3`                                                            |
| Situação | `--pendente` `--confirmado` `--rejeitado` `--sigilo`, cada um com o par `-bg`             |
| Fonte    | `--serif` (autoridade e conteúdo de documento) `--sans` (operar) `--mono` (`.data`)       |
| Escala   | `--step--1` .875 · `--step-0` 1 · `--step-1` 1.25 · `--step-2` 1.75 · `--step-3` 2.375rem |
| Espaço   | `--space-1` .25 → `--space-7` 3rem                                                        |
| Canto    | `--radius-sm` 4 · `--radius` 7 · `--radius-lg` 12px                                       |
| Largura  | `--content-max` 108rem                                                                    |

O escuro é o tratamento principal e vive em `:root`. O claro entra por
`prefers-color-scheme` ou `data-theme`. **Toda cor nova precisa dos dois.**

---

## 3. Classes que já existem — não redefina

De `styles.css`:

| Classe             | Uso                                                   |
| ------------------ | ----------------------------------------------------- |
| `.btn`             | ação primária                                         |
| `.btn--ghost`      | ação secundária                                       |
| `.field`           | envelope de rótulo + controle; aceita `> input`       |
| `.field__hint`     | ajuda abaixo do campo                                 |
| `.field__error`    | erro do campo, com `aria-invalid` no controle         |
| `.label`           | rótulo em versalete                                   |
| `.data`            | identificador jurídico: CNJ, CPF, código, folha, hash |
| `.muted`           | texto secundário                                      |
| `.visually-hidden` | some da tela, permanece para leitor e para o foco     |

De `patterns.css`:

| Classe                                                                               | Uso                       |
| ------------------------------------------------------------------------------------ | ------------------------- |
| `.crumb`                                                                             | migalha de navegação      |
| `.head` `.head__lede` `.head__actions`                                               | cabeçalho da tela         |
| `.verdict` `.verdict--alert`                                                         | a resposta antes da lista |
| `.panel` `.panel__bar` `.panel__count` `.panel__body` `.panel__more`                 | contêiner de conteúdo     |
| `.scroll-x` `.rows` `.rows__link` `.rows__title` `.rows__meta` `.right` `.nowrap`    | tabela                    |
| `.state` `.state--error` `.state__title` `.state__body` `.state__list` `.state__ref` | vazio e erro              |
| `.note`                                                                              | limitação declarada       |
| `.skeleton` `.skeleton-row`                                                          | carregando                |

**Só escreva `<style scoped>` para o que é próprio da tela.** Se a regra serviria a outra
tela, ela pertence a `patterns.css`.

---

## 4. Componentes

| Componente              | Para quê                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `StatusChip.vue`        | situação em uma palavra; tons `neutro` `pendente` `confirmado` `rejeitado` `sigilo` |
| `ProvenanceMark.vue`    | dado vindo de IA, com a fonte revelada no hover e no foco                           |
| `FileIntakePanel.vue`   | envio multipart com pré-verificação e resultado parcial                             |
| `PreparationStatus.vue` | progresso do preparo em verbo do dia a dia                                          |
| `AppShell.vue`          | moldura autenticada; adicione o link de seção aqui                                  |

---

## 5. Vocabulário

Nenhum rótulo técnico chega à tela. `apps/web/src/domain/vocabulary.ts` traduz tudo:
mapas de situação de caso, prioridade, sigilo, participante, checklist, tarefa e modo de
busca; `humanizeCode` para texto livre em MAIÚSCULA_COM_UNDERSCORE; `formatDate`,
`formatDateTime`, `formatEventDate` (respeita a precisão registrada, em UTC), `formatDueDate`
("Vence hoje", "Atrasada 3 dias") e `formatBytes`.

Faltou um rótulo? Adicione **lá**, com o mapa tipado pelo union da API — assim um valor novo
no contrato quebra o typecheck em vez de vazar na tela.

---

## 6. Esqueleto de uma tela

```vue
<script setup lang="ts">
// 1. estado: loading, failure, dados, e o que a tela responde
// 2. load() com try/catch/finally, ApiError preservado para `detailFor` e `requestId`
// 3. onMounted(() => void load())
</script>

<template>
  <section aria-labelledby="x-title">
    <p class="crumb">…</p>
    <header class="head">
      <div>
        <h1 id="x-title">…</h1>
        <p class="head__lede">…</p>
      </div>
      <div class="head__actions">…</div>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando …</p>
      <div v-for="row in 5" :key="row" class="skeleton-row">…</div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível …</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <div v-else-if="items.length === 0" class="state">
      <h2 class="state__title">…</h2>
      <p class="state__body">…</p>
    </div>

    <template v-else>
      <p class="verdict" role="status">…</p>
      <div class="panel">…</div>
    </template>
  </section>
</template>
```

---

## 7. Regras que reprovam a revisão

1. **Rótulo técnico na tela.** `READY_TO_FILE` nunca; "Pronto para protocolo".
2. **Cor como único sinal.** Atraso e bloqueio ganham faixa ou texto, além do tom.
3. **`v-html` em conteúdo de documento.** É evidência não confiável. Realce por segmentos —
   ver `domain/highlight.ts`.
4. **Botão que não faz nada.** Se a rota não existe, declare a ausência.
5. **Conteúdo pesquisado na URL.** Identificador pode; texto não.
6. **Foco invisível.** O anel é critério de aceite, não preferência.
7. **Erro virando lista vazia.** São estados diferentes e o usuário precisa saber qual é.
8. **Um valor cru de cor, espaço ou tamanho.** Use token.

---

## 8. Teste da tela

Vitest em `apps/web/src/__tests__/<tela>.spec.ts`, com `request` mockado. Cubra:

- **o que a tela responde** — o veredito, não só a presença da lista;
- **nenhum rótulo técnico** — `expect(text).not.toContain('OPEN')`;
- **erro recuperável** — falha não pode virar vazio;
- **a ausência declarada** — nenhum botão para o que a API não faz;
- **tempo fixo** quando houver prazo: `vi.setSystemTime`, senão o teste depende do relógio.

Playwright só para o fluxo crítico, em `apps/web/e2e/`, sem criar dado jurídico.

---

## 9. Manutenção

Ao criar uma classe que serviria a outra tela, mova para `patterns.css` e cite aqui na
mesma mudança. Este arquivo perde o valor no instante em que ficar desatualizado.

**Dívida conhecida:** as views anteriores a `patterns.css` ainda carregam cópias das mesmas
regras no `<style scoped>` — `.panel` em treze arquivos, `.state__title` em nove. O escopo
tem especificidade maior, então elas continuam corretas; a limpeza é um cartão do quadro,
e depende de haver cobertura visual para ser feita com segurança.
