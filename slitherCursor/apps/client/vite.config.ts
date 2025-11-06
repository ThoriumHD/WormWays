// apps/client/vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  // This aligns esbuild with your tsconfig target so top-level await is supported
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@slither/common': path.resolve(__dirname, '../../packages/common/src'),
    },
  },
});
