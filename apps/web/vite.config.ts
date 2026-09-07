import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // O cálculo do dígito verificador do CNJ é o mesmo que a API usa para recusar. Aponta
      // para a fonte, e não para `dist`, porque a Vercel compila só este pacote — uma cópia
      // aqui divergiria em silêncio, que é o pior jeito de errar um dígito verificador.
      '@lex-os/shared/cnj': fileURLToPath(
        new URL('../../packages/shared/src/cnj.ts', import.meta.url),
      ),
      '@lex-os/shared/legal-vocabulary': fileURLToPath(
        new URL('../../packages/shared/src/legal-vocabulary.ts', import.meta.url),
      ),
      // O catálogo de especialidades entra pelo mesmo caminho, e pelo mesmo motivo: a tela precisa
      // oferecer exatamente as faixas que a biblioteca de prompts reconhece. Uma cópia da lista
      // aqui divergiria no dia em que uma faixa nova entrasse, e o cliente escolheria uma área
      // que não existe.
      '@lex-os/shared/legal-specialties': fileURLToPath(
        new URL('../../packages/shared/src/legal-specialties.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    allowedHosts: ['.railway.internal', '.railway.app'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
});
