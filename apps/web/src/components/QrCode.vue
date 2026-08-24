<script setup lang="ts">
import qrcode from 'qrcode-generator';
import { computed } from 'vue';

/**
 * Código de barras bidimensional, em SVG.
 *
 * A codificação vem de biblioteca, e essa foi uma decisão consciente. O TOTP foi escrito aqui
 * porque cabe em dezenas de linhas e os vetores da RFC provam que está certo; o QR não tem
 * esse luxo — correção de erros Reed-Solomon, escolha de máscara e informação de formato
 * erram **em silêncio**, e um código sutilmente errado só aparece quando alguém tenta ler.
 *
 * SVG e não canvas: nítido em qualquer tela e em papel, sem depender de resolução, e o
 * conteúdo é uma única cadeia de caminhos em vez de milhares de elementos.
 */

const props = withDefaults(
  defineProps<{
    value: string;
    /** Rótulo para quem usa leitor de tela, já que a imagem não diz nada por si. */
    label: string;
    size?: number;
  }>(),
  { size: 208 },
);

/**
 * Correção de erro média: aguenta cerca de 15% do código danificado, que cobre reflexo de
 * tela e dedo na frente da câmera sem inflar o tamanho como o nível alto faria.
 */
const modules = computed(() => {
  const qr = qrcode(0, 'M');
  qr.addData(props.value);
  qr.make();
  const count = qr.getModuleCount();
  const paths: string[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        paths.push(`M${column} ${row}h1v1h-1z`);
      }
    }
  }
  // Quatro módulos de margem silenciosa: sem ela, leitor nenhum encontra o código.
  return { count, path: paths.join(''), extent: count + 8 };
});
</script>

<template>
  <svg
    class="qr"
    role="img"
    :aria-label="label"
    :width="size"
    :height="size"
    :viewBox="`-4 -4 ${modules.extent} ${modules.extent}`"
    shape-rendering="crispEdges"
  >
    <rect :x="-4" :y="-4" :width="modules.extent" :height="modules.extent" fill="#ffffff" />
    <path :d="modules.path" fill="#000000" />
  </svg>
</template>

<style scoped>
/*
 * Preto no branco, sempre — inclusive no tema escuro. Um QR com as cores do tema pode até
 * ler, mas nem toda câmera aceita polaridade invertida, e a moldura branca é o que garante
 * o contraste que o leitor procura.
 */
.qr {
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: #ffffff;
  display: block;
}
</style>
