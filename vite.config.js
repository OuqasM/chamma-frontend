import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy in dev so the SPA is same-origin: no CORS, and image URLs from
    // the API resolve without a second host.
    proxy: {
      '/api': { target: api, changeOrigin: true },
      '/images': { target: api, changeOrigin: true },
      '/storage': { target: api, changeOrigin: true },
    },
  },
  preview: { port: 5173, host: true },
  test: {
    // Each suite picks its own environment with a `@vitest-environment`
    // docblock; this only adds the setup file, which every suite loads.
    setupFiles: ['./src/test-setup.js'],
  },
})
