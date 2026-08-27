import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        main: 'pages/index.html',
      },
    },
  },
  plugins: [
    legacy({
      targets: ['> 0.5%', 'last 2 versions', 'not dead'],
      additionalLegacyPolyfills: ['regenerator-runtime'],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
