import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** GitHub Pages sets BASE_PATH=/<repo-name>/. './' works on any static host. */
const base = process.env.BASE_PATH || './';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      // New versions wait until the app is on a calm screen (see src/app/update-gate.ts).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'Tibu',
        short_name: 'Tibu',
        description: 'Tibu, a block world for tiny builders.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#c9ecff',
        theme_color: '#7ec8f2',
        categories: ['education', 'games', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,webmanifest,ico,woff2,m4a,mp3,ogg,wav}'],
        // Voice clips and the three.js chunk can exceed the 2 MB default.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The first install still controls the open page at once (offline in the first session).
        // No skipWaiting: updates wait for the app's go-ahead.
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
