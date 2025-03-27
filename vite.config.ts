import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
  plugins: [sveltekit()],
  preview: {
    port: 3000
  },
  server: {
    port: 3000
  }
};

export default config;
