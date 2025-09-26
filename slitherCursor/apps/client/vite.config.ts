import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  server: { host: true, port: 5173 },
  resolve: {
    alias: {
      '@packages/proto': path.resolve(__dirname, '../../packages/proto/src'),
    },
  },
});


