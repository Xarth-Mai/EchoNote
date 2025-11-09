import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $utils: 'src/utils'
    }
  }
};

export default config;
