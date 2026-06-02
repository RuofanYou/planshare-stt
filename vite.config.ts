import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PlanShare 前端构建配置：Vite + React 18 + TS + Tailwind v4。
// dev 期间 /api/* 反代到本地 Fastify 后端（端口 3001）。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    allowedHosts: ['.trycloudflare.com', '.cpolar.top', '.cpolar.cn'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
