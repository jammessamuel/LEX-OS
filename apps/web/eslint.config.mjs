import vue from '@lex-os/eslint-config/vue';

// A pasta .vercel guarda artefatos de build do deploy (minificados); não é código-fonte.
export default [{ ignores: ['.vercel/**'] }, ...vue];
