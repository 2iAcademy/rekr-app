import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sentryVitePlugin({
    org: "diego-b0",
    project: "rekr"
  })],

  build: {
    sourcemap: true
  },
 preview: {
  port: 8080,
  strictPort: true,
 },
 server: {
  port: 8080,
  strictPort: true,
  host: true,
  proxy: {
   '/api': {
    target: process.env.VITE_API_TARGET ?? 'http://localhost:3001',
    changeOrigin: true,
   },
  },
  watch: {
   usePolling: true,
   interval: 100,
  },
 },
});
