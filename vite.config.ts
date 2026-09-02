import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'strip-crossorigin-for-static-hosts',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin/g, '')
      },
    },
  ],
  build: {
    modulePreload: false,
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    strictPort: false,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
