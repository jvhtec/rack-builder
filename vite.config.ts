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
      manifest: {
        name: 'Rack Builder',
        short_name: 'RackBuilder',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'rack_builder.png', sizes: '192x192', type: 'image/png' },
          { src: 'rack_builder.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})
