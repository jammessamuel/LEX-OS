/**
 * Preferências de entrada, guardadas neste dispositivo.
 *
 * O que fica aqui é conveniência: o nome curto do escritório, o e-mail, a escolha de
 * continuar conectado e a última tela aberta. Credenciais nunca entram neste registro;
 * quem quiser preencher a senha novamente usa o gerenciador protegido do navegador.
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
  /** Caminho interno da última tela. Só caminho: nada de conteúdo pesquisado. */
  lastRoute: string | null;
}

const empty: SignInPreferences = {
  organizationSlug: '',
  email: '',
  keepSignedIn: false,
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
    const next: SignInPreferences = {
      organizationSlug: typeof record.organizationSlug === 'string' ? record.organizationSlug : '',
      email: typeof record.email === 'string' ? record.email : '',
      keepSignedIn: record.keepSignedIn === true,
      lastRoute: isInternalPath(record.lastRoute) ? record.lastRoute : null,
    };
    // Versões anteriores ofereciam guardar a senha em texto puro. Ler uma preferência antiga
    // também é a migração: reescreve apenas os campos seguros e remove a credencial do disco.
    if ('password' in record || 'savePassword' in record) {
      write(next);
    }
    return next;
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
}): void {
  write({
    ...readPreferences(),
    ...input,
  });
}

/** Esquece o que identifica a pessoa e mantém apenas o escritório, que é do dispositivo. */
export function forgetIdentity(): void {
  const current = readPreferences();
  write({
    organizationSlug: current.organizationSlug,
    email: '',
    keepSignedIn: false,
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
