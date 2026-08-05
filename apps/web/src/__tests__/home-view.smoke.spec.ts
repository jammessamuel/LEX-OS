import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import HomeView from '../views/HomeView.vue';

describe('HomeView', () => {
  it('identifies the bootstrap delivery without presenting a product feature', () => {
    const wrapper = mount(HomeView);

    expect(wrapper.get('h1').text()).toBe('Fundação técnica');
    expect(wrapper.get('[role="status"]').text()).toContain('bootstrap configurado');
  });
});
