import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV !== 'production';

const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    dev,
  },
};

export default config;
