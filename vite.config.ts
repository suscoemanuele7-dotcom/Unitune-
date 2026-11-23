import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // `injectManifest`: scriviamo noi il service worker (src/sw.ts) invece di
      // farlo generare. Così controlliamo in modo esplicito cosa viene messo in
      // cache: SOLO la shell statica dell'app, mai contenuti YouTube.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // L'aggiornamento non è automatico: l'utente vede un avviso e sceglie
      // quando ricaricare (evita di interrompere la riproduzione in corso).
      registerType: 'prompt',
      // La registrazione la fa il componente PwaUpdatePrompt tramite
      // `virtual:pwa-register/react`.
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
      manifest: {
        id: '/',
        name: 'UniTune',
        short_name: 'UniTune',
        description: 'Musica per studenti, riprodotta con il player ufficiale di YouTube.',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f0f14',
        theme_color: '#0f0f14',
        categories: ['music', 'entertainment', 'education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        // Scorciatoie (tenendo premuta l'icona su Android).
        shortcuts: [
          { name: 'Cerca', short_name: 'Cerca', url: '/search', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          {
            name: 'La tua libreria',
            short_name: 'Libreria',
            url: '/library',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      devOptions: {
        // In sviluppo il SW resta spento: evita cache "fantasma" durante l'HMR.
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
