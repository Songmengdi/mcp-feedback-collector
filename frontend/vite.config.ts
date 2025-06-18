import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      // 代理Socket.IO请求到开发服务器
      '/socket.io': {
        target: 'http://localhost:10050',
        changeOrigin: true,
        ws: true
      },
      // 代理API请求到开发服务器
      '/api': {
        target: 'http://localhost:10050',
        changeOrigin: true
      },
    }
  }
})
