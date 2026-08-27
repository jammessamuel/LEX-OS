<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type {
  NotificationPreferences,
  SecondFactorActivated,
  SecondFactorEnrolment,
  SecondFactorStatus,
} from '../api/types.js';
import QrCode from '../components/QrCode.vue';
import { useSessionStore } from '../stores/session.js';

/**
 * Segurança da conta.
 *
 * A pergunta aqui é uma só — "o meu acesso está protegido?" — e a resposta vem antes de
 * qualquer instrução. Quem já ativou não precisa ler nada; quem não ativou precisa saber o
 * que ganha e quanto custa em minutos.
 */

const session = useSessionStore();

const status = ref<SecondFactorStatus | null>(null);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

const enrolment = ref<SecondFactorEnrolment | null>(null);
const code = ref('');
const busy = ref(false);
const stepFailure = ref<ApiError | null>(null);
/** Aparecem uma vez só. Guardar em outro lugar seria repetir o erro que eles evitam. */
const recoveryCodes = ref<string[] | null>(null);

const disabling = ref(false);
const disableCode = ref('');

const active = computed(() => status.value?.active === true);
const lowOnCodes = computed(() => active.value && (status.value?.unusedRecoveryCodes ?? 0) <= 3);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    status.value = await request<SecondFactorStatus>('/auth/second-factor');
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar a segurança da conta.');
  } finally {
    loading.value = false;
  }
}

async function begin(): Promise<void> {
  busy.value = true;
  stepFailure.value = null;
  try {
    enrolment.value = await request<SecondFactorEnrolment>('/auth/second-factor', {
      method: 'POST',
    });
  } catch (error) {
    stepFailure.value = toApiError(error, 'Não foi possível começar o cadastro.');
  } finally {
    busy.value = false;
  }
}

async function activate(): Promise<void> {
  busy.value = true;
  stepFailure.value = null;
  try {
    const result = await request<SecondFactorActivated>('/auth/second-factor/activate', {
      method: 'POST',
      body: { code: code.value },
    });
    recoveryCodes.value = result.recoveryCodes;
    enrolment.value = null;
    code.value = '';
    await load();
  } catch (error) {
    stepFailure.value = toApiError(error, 'Não foi possível ativar.');
    code.value = '';
  } finally {
    busy.value = false;
  }
}

async function disable(): Promise<void> {
  busy.value = true;
  stepFailure.value = null;
  try {
    await request('/auth/second-factor', { method: 'DELETE', body: { code: disableCode.value } });
    disabling.value = false;
    disableCode.value = '';
    await load();
  } catch (error) {
    stepFailure.value = toApiError(error, 'Não foi possível desligar.');
    disableCode.value = '';
  } finally {
    busy.value = false;
  }
}

/** Em grupos de quatro: trinta e dois caracteres seguidos ninguém digita sem errar. */
const readableSecret = computed(() =>
  (enrolment.value?.secret ?? '').replace(/(.{4})/gu, '$1 ').trim(),
);

function cancelEnrolment(): void {
  enrolment.value = null;
  code.value = '';
  stepFailure.value = null;
}

const avisos = ref<NotificationPreferences | null>(null);
const salvandoAvisos = ref(false);
const falhaAvisos = ref<ApiError | null>(null);

const ROTULOS: Readonly<Record<string, [string, string]>> = {
  'task-assigned': [
    'Tarefa atribuída a você',
    'Quando alguém coloca uma tarefa no seu nome. Tarefa que você mesmo se atribui não avisa.',
  ],
  'preparation-digest': [
    'Resumo de preparação concluída',
    'Um resumo por dia dos documentos que terminaram o preparo nos casos sob sua responsabilidade.',
  ],
};

function rotuloDoAviso(aviso: string): string {
  return ROTULOS[aviso]?.[0] ?? aviso;
}

function explicacaoDoAviso(aviso: string): string {
  return ROTULOS[aviso]?.[1] ?? '';
}

async function carregarAvisos(): Promise<void> {
  try {
    avisos.value = await request<NotificationPreferences>('/auth/notifications');
  } catch {
    // Aviso é secundário nesta tela: falhar aqui não pode esconder o segundo fator, que é a
    // razão de a pessoa ter aberto isto.
    avisos.value = null;
  }
}

/**
 * Liga ou desliga um aviso.
 *
 * Manda o conjunto inteiro, e não a mudança: duas abas abertas mandando pedidos opostos viram
 * um problema de última escrita, em vez de um estado que ninguém sabe reconstruir.
 */
async function alternarAviso(aviso: string): Promise<void> {
  if (avisos.value === null) {
    return;
  }
  const atual = avisos.value.silenced;
  const proximo = atual.includes(aviso)
    ? atual.filter((item) => item !== aviso)
    : [...atual, aviso];
  salvandoAvisos.value = true;
  falhaAvisos.value = null;
  try {
    avisos.value = await request<NotificationPreferences>('/auth/notifications', {
      method: 'PUT',
      body: { silenced: proximo },
    });
  } catch (error) {
    falhaAvisos.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível salvar a preferência de avisos.',
          });
  } finally {
    salvandoAvisos.value = false;
  }
}

onMounted(() => {
  void load();
  void carregarAvisos();
});
</script>

<template>
  <section aria-labelledby="security-title">
    <header class="head">
      <div>
        <h1 id="security-title">Segurança da conta</h1>
        <p class="head__lede">{{ session.user?.name }} · {{ session.user?.email }}</p>
      </div>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando a segurança da conta.</p>
      <div v-for="row in 2" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 38%" />
        <span class="skeleton" style="width: 20%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar</h2>
      <p class="state__body">{{ failure.message }}</p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else>
      <p class="verdict" :class="{ 'verdict--alert': !active }" role="status">
        <template v-if="active">
          <strong>Seu acesso pede duas provas.</strong>
          Senha e um código do aplicativo, a cada entrada.
        </template>
        <template v-else>
          <strong>Seu acesso depende só da senha.</strong>
          Quem descobrir a sua senha entra no acervo do escritório.
        </template>
      </p>

      <!-- Os códigos aparecem uma vez. O aviso precisa vir antes de a pessoa fechar. -->
      <div v-if="recoveryCodes" class="issued" role="status">
        <h2 class="issued__title">Segundo fator ativado</h2>
        <p class="issued__body">
          Guarde estes dez códigos de recuperação em lugar seguro — fora deste computador e fora do
          telefone que gera os códigos. Cada um serve uma vez, e é assim que você entra se perder o
          aparelho. <strong>Eles não aparecem de novo.</strong>
        </p>
        <ul class="codes">
          <li v-for="value in recoveryCodes" :key="value" class="data">{{ value }}</li>
        </ul>
        <button class="btn" type="button" @click="recoveryCodes = null">Já guardei</button>
      </div>

      <div class="panel">
        <div class="panel__bar">
          <span class="label">Segundo fator</span>
          <span v-if="active" class="data panel__count">
            {{ status?.unusedRecoveryCodes }} códigos de recuperação restantes
          </span>
        </div>

        <div class="panel__body">
          <!-- Cadastro em andamento -->
          <template v-if="enrolment">
            <p class="lede">
              Abra o aplicativo autenticador e leia o código abaixo. Depois confirme com os seis
              dígitos que ele mostrar — só assim o segundo fator passa a valer.
            </p>
            <div class="enrol">
              <QrCode :value="enrolment.uri" label="Código para o aplicativo autenticador" />
              <div class="enrol__manual">
                <p class="label">Ou cadastre a chave à mão</p>
                <p class="secret data">{{ readableSecret }}</p>
              </div>
            </div>
            <p class="lede">
              <a class="link" :href="enrolment.uri">Abrir direto no aplicativo</a>
              — funciona quando esta página está no próprio telefone.
            </p>

            <div class="field confirm">
              <label class="label" for="code">Código do aplicativo</label>
              <input
                id="code"
                v-model="code"
                class="data code"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="123456"
              />
            </div>

            <p v-if="stepFailure" class="error" role="alert">{{ stepFailure.message }}</p>

            <div class="actions">
              <button
                class="btn"
                type="button"
                :disabled="busy || code.length < 6"
                @click="activate"
              >
                {{ busy ? 'Confirmando…' : 'Confirmar e ativar' }}
              </button>
              <button class="btn btn--ghost" type="button" @click="cancelEnrolment">
                Cancelar
              </button>
            </div>
          </template>

          <!-- Desligamento em andamento -->
          <template v-else-if="disabling">
            <p class="lede">
              Para desligar, confirme com um código do aplicativo. A prova existe para que alguém
              com a sua sessão aberta não consiga remover a proteção.
            </p>
            <div class="field confirm">
              <label class="label" for="disableCode">Código do aplicativo</label>
              <input
                id="disableCode"
                v-model="disableCode"
                class="data code"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="123456"
              />
            </div>
            <p v-if="stepFailure" class="error" role="alert">{{ stepFailure.message }}</p>
            <div class="actions">
              <button
                class="btn"
                type="button"
                :disabled="busy || disableCode.length < 6"
                @click="disable"
              >
                {{ busy ? 'Desligando…' : 'Desligar segundo fator' }}
              </button>
              <button class="btn btn--ghost" type="button" @click="disabling = false">
                Cancelar
              </button>
            </div>
          </template>

          <!-- Estado de repouso -->
          <template v-else>
            <p class="lede">
              Um código temporário, gerado pelo seu telefone, somado à senha. Leva dois minutos para
              configurar e vale para sempre.
            </p>
            <p v-if="status?.requiredByOrganization" class="lede">
              <strong>O escritório exige o segundo fator</strong>, então ele não pode ser desligado
              por aqui.
            </p>
            <p v-if="lowOnCodes" class="warn">
              Restam poucos códigos de recuperação. Para gerar outros, desligue e ative de novo.
            </p>
            <p v-if="stepFailure" class="error" role="alert">{{ stepFailure.message }}</p>

            <div class="actions">
              <button v-if="!active" class="btn" type="button" :disabled="busy" @click="begin">
                {{ busy ? 'Preparando…' : 'Ativar segundo fator' }}
              </button>
              <button
                v-else-if="!status?.requiredByOrganization"
                class="btn btn--ghost"
                type="button"
                @click="disabling = true"
              >
                Desligar
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
    <!--
      Os avisos ficam aqui e não numa tela própria: a pergunta "o que chega no meu e-mail" é
      da mesma família de "quem entra na minha conta", e as duas se respondem no mesmo lugar.
    -->
    <div v-if="avisos" class="panel avisos">
      <h2 class="avisos__titulo">Avisos por e-mail</h2>
      <p class="avisos__lede muted">
        O e-mail carrega o código do caso, o que aconteceu e um link. Nunca documento, nome de parte
        ou teor de peça — o resto só se vê aqui dentro, com a sua permissão de sempre.
      </p>

      <label v-for="aviso in avisos.silenceable" :key="aviso" class="aviso">
        <input
          type="checkbox"
          :checked="!avisos.silenced.includes(aviso)"
          :disabled="salvandoAvisos"
          @change="alternarAviso(aviso)"
        />
        <span>
          <span class="aviso__nome">{{ rotuloDoAviso(aviso) }}</span>
          <span class="aviso__nota muted">{{ explicacaoDoAviso(aviso) }}</span>
        </span>
      </label>

      <p class="aviso aviso--fixo">
        <span class="aviso__nome">Documento que falhou na preparação</span>
        <span class="aviso__nota muted">
          Este não se desliga. Documento parado costuma custar prazo, e o aviso é a única coisa
          entre a falha e a véspera.
        </span>
      </p>

      <p v-if="falhaAvisos" class="note note--alert" role="alert">{{ falhaAvisos.message }}</p>
    </div>
  </section>
</template>

<style scoped>
.avisos {
  margin-top: var(--space-5);
  padding: var(--space-4);
}

.avisos__titulo {
  margin: 0 0 var(--space-2);
  font-size: 1.05rem;
}

.avisos__lede {
  margin: 0 0 var(--space-4);
  font-size: 0.88rem;
  max-width: 46rem;
  line-height: 1.55;
}

.aviso {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--line);
}

.aviso--fixo {
  display: block;
  margin: 0;
  opacity: 0.72;
}

.aviso__nome {
  display: block;
  font-weight: 500;
}

.aviso__nota {
  display: block;
  font-size: 0.82rem;
  line-height: 1.5;
  margin-top: 0.15rem;
}

.lede {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 68ch;
}

.lede + .lede,
.actions,
.confirm {
  margin-top: var(--space-4);
}

/* A chave é para ser lida em voz alta e digitada em outro aparelho. */
.enrol {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  flex-wrap: wrap;
  margin-top: var(--space-4);
}

.enrol__manual {
  flex: 1 1 18rem;
  min-width: 0;
}

.secret {
  margin-top: var(--space-2);
  font-size: var(--step-1);
  letter-spacing: 0.08em;
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  overflow-wrap: anywhere;
  user-select: all;
}

.code {
  font-size: var(--step-1);
  letter-spacing: 0.18em;
  max-width: 12rem;
}

.link {
  color: var(--ink);
}

.actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.error {
  margin-top: var(--space-3);
  font-size: var(--step--1);
  color: var(--rejeitado);
}

.warn {
  margin-top: var(--space-3);
  font-size: var(--step--1);
  color: var(--pendente);
}

.issued {
  background: var(--confirmado-bg);
  border: 1px solid color-mix(in oklab, var(--confirmado) 34%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.issued__title {
  font-size: var(--step-1);
}

.issued__body {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 68ch;
}

.codes {
  list-style: none;
  margin: 0;
  padding: 0;
  columns: 2 10rem;
  column-gap: var(--space-5);
  font-size: var(--step-0);
  letter-spacing: 0.06em;
}

.codes li {
  break-inside: avoid;
  padding: 0.1rem 0;
  user-select: all;
}
</style>
