/**
 * Preferências de entrada, guardadas neste dispositivo.
 *
 * O que fica aqui é conveniência: o nome curto do escritório, o e-mail, a escolha de
 * continuar conectado e a última tela aberta.
 *
 * **A senha também, quando a pessoa pede explicitamente.** Isso é uma escolha do dono do
 * produto, tomada com o custo à vista: em `localStorage` a senha fica em texto puro no
 * disco, legível por qualquer script que venha a rodar na página. O gerenciador do navegador
 * continua sendo o caminho recomendado — o formulário declara `name` e `autocomplete` para
 * ele se oferecer — e guardar aqui é o atalho para quem prefere não depender dele.
 *
 * Está registrado como bloqueio de produção no README: antes de dado real de cliente, esta
 * opção precisa sair ou virar decisão por escritório.
 *
 * Toda leitura e escrita é protegida: janela anônima, armazenamento desativado por política
 * e navegador que lança ao acessar são situações normais, e nenhuma delas pode impedir
 * alguém de entrar.
 */

const KEY = 'lex-os.entrada';

export interface SignInPreferences {
  organizationSlug: string;
  email: string;
  keepSignedIn: boolean;
  /** Guardada apenas se a pessoa marcar a opção. Ver o aviso no topo do arquivo. */
  password: string;
  savePassword: boolean;
  /** Caminho interno da última tela. Só caminho: nada de conteúdo pesquisado. */
  lastRoute: string | null;
}

const empty: SignInPreferences = {
  organizationSlug: '',
  email: '',
  keepSignedIn: false,
  password: '',
  savePassword: false,
  lastRoute: null,
};

function isInternalPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    value.length <= 512
  );
}

export function readPreferences(): SignInPreferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      return { ...empty };
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') {
      return { ...empty };
    }
    const record = parsed as Record<string, unknown>;
    return {
      organizationSlug: typeof record.organizationSlug === 'string' ? record.organizationSlug : '',
      email: typeof record.email === 'string' ? record.email : '',
      keepSignedIn: record.keepSignedIn === true,
      savePassword: record.savePassword === true,
      // Só devolve a senha se a opção continuar ligada: desmarcar precisa apagar de fato.
      password:
        record.savePassword === true && typeof record.password === 'string' ? record.password : '',
      lastRoute: isInternalPath(record.lastRoute) ? record.lastRoute : null,
    };
  } catch {
    return { ...empty };
  }
}

function write(next: SignInPreferences): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Guardar é conveniência. Não conseguir guardar não pode interromper nada.
  }
}

export function rememberSignIn(input: {
  organizationSlug: string;
  email: string;
  keepSignedIn: boolean;
  savePassword: boolean;
  password: string;
}): void {
  write({
    ...readPreferences(),
    ...input,
    // Desmarcar apaga na hora. Guardar a senha "por via das dúvidas" depois de a pessoa
    // dizer que não quer seria pior que nunca ter oferecido.
    password: input.savePassword ? input.password : '',
  });
}

/** Esquece o que identifica a pessoa e mantém apenas o escritório, que é do dispositivo. */
export function forgetIdentity(): void {
  const current = readPreferences();
  write({
    organizationSlug: current.organizationSlug,
    email: '',
    keepSignedIn: false,
    password: '',
    savePassword: false,
    lastRoute: null,
  });
}

export function rememberRoute(path: string): void {
  if (!isInternalPath(path)) {
    return;
  }
  write({ ...readPreferences(), lastRoute: path });
}

export function clearAll(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Mesmo motivo da escrita.
  }
}
