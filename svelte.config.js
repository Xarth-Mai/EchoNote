import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: true
    }),
    prerender: {
      entries: ['*']
    },
    alias: {
      $utils: 'src/utils'
    }
  }
};

export default config;
