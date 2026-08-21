export const ACCESS_TOKEN_AUDIENCE = 'lex-os-web';
export const ACCESS_TOKEN_ISSUER = 'lex-os-api';
export const REFRESH_COOKIE_NAME = 'lex_os_refresh';

/**
 * Marcador de "manter conectado". Acompanha o cookie de atualização e não carrega segredo
 * algum: ele existe só para a rotação saber se deve continuar persistindo.
 *
 * Sem ele, a primeira renovação rebaixaria uma sessão persistente para sessão de janela, e
 * quem marcou a opção seria deslogado ao fechar o navegador mesmo assim.
 */
export const REFRESH_PERSIST_COOKIE_NAME = 'lex_os_persistir';
