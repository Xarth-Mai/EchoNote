import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $components: 'src/components',
      $utils: 'src/utils'
    }
  }
};

export default config;
