import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      strict: false
    }),
    alias: {
      $utils: 'src/utils'
    }
  }
};

export default config;
