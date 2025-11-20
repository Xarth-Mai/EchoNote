import adapter from '@eslym/sveltekit-adapter-bun';

const config = {
  kit: {
    adapter: adapter({
      precompress: true
    }),
    alias: {
      $utils: 'src/utils'
    }
  }
};

export default config;
