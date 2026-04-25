import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/chat': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/graph': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
