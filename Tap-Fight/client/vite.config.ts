import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:42222',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:42222',
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
