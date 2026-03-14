import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rawBasePath = (process.env.BASE_PATH || '/').trim()
const withLeadingSlash = rawBasePath.startsWith('/')
  ? rawBasePath
  : `/${rawBasePath}`
const basePath = withLeadingSlash.endsWith('/')
  ? withLeadingSlash
  : `${withLeadingSlash}/`

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'rack_builder.png'],
      manifest: {
        name: 'Rack Builder',
        short_name: 'Rack Builder',
        description: 'Professional AV/IT rack layout builder',
        theme_color: '#0f172a',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'any',
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
