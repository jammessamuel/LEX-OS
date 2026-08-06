import { createPinia } from 'pinia';
import { createApp } from 'vue';

import { setUnauthorizedHandler } from './api/client.js';
import App from './App.vue';
import { router } from './router';
import { useSessionStore } from './stores/session.js';
import './styles.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Quando a renovação silenciosa também falha, a sessão acabou: limpa o estado local e
// devolve ao login em vez de deixar a interface tentando ler dados que não virão.
setUnauthorizedHandler(() => {
  useSessionStore(pinia).clear();
  void router.replace({ name: 'login' });
});

app.mount('#app');
