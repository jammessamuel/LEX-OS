import { computed, ref } from 'vue';

export type ThemePreference = 'dark' | 'light';

const storageKey = 'lex-os-theme';
const preference = ref<ThemePreference>('dark');

function isTheme(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light';
}

function apply(value: ThemePreference): void {
  preference.value = value;
  document.documentElement.dataset.theme = value;
}

/** Preferência visual não contém dado jurídico e pode persistir no navegador. */
export function initializeTheme(): void {
  const stored = localStorage.getItem(storageKey);
  apply(isTheme(stored) ? stored : 'dark');
}

export function useTheme() {
  const nextLabel = computed(() =>
    preference.value === 'dark' ? 'Usar tema claro' : 'Usar tema escuro',
  );

  function toggle(): void {
    const next = preference.value === 'dark' ? 'light' : 'dark';
    apply(next);
    localStorage.setItem(storageKey, next);
  }

  return { preference, nextLabel, toggle };
}
