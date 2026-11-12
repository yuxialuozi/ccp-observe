import { defineConfig } from 'vite';

// The panel is served from /_ccp/ by the proxy and from Tauri's asset protocol
// in the desktop build, so all asset URLs must stay relative.
export default defineConfig({
  base: './',
  build: {
    outDir: '../proxy/static',
    emptyOutDir: true,
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    port: 5273,
    proxy: {
      '/_ccp/api': 'http://127.0.0.1:8787',
    },
  },
});
