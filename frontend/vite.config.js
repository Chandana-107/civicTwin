import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/users': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/complaints': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/tenders': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/fraud': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/simulation': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/topics': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/social': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/sentiment': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/alerts': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
