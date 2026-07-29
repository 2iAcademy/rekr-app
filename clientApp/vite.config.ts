import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Workbox writes the service worker after Sentry's delete hook has run,
      // so its maps would survive in dist. They carry no app source, only the
      // local build path — not worth publishing either.
      workbox: {
        sourcemap: false,
      },
      manifest: {
        name: 'Rekr',
        short_name: 'Rekr',
        theme_color: '#0EA672',
        lang: 'fr',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    sentryVitePlugin({
      org: 'diego-b0',
      project: 'rekr',
      sourcemaps: {
        // Sentry uploads the maps (matching is done via injected debug ids),
        // then deletes them so they are never served next to the bundle.
        // The plugin runs this in a `finally` block, so the files are removed
        // even on a build without SENTRY_AUTH_TOKEN, where upload is skipped.
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // 'hidden' still emits the .map files Sentry needs, but drops the
    // `//# sourceMappingURL=` comment from the bundle, so the source is not
    // discoverable from the browser even if a map ever survives the build.
    sourcemap: 'hidden',
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
