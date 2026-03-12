import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
})
