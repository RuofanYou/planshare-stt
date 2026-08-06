import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const localPath = (path: string) => decodeURIComponent(new URL(path, import.meta.url).pathname)

const fengariLualibShim = localPath('./src/lib/node-shims/fengari-lualib.ts')
const childProcessShim = localPath('./src/lib/node-shims/child_process.ts')
const fsShim = localPath('./src/lib/node-shims/fs.ts')
const osShim = localPath('./src/lib/node-shims/os.ts')
const readlineSyncShim = localPath('./src/lib/node-shims/readline-sync.ts')
const tmpShim = localPath('./src/lib/node-shims/tmp.ts')

// PlanShare 前端构建配置：Vite + React 18 + TS + Tailwind v4。
// dev 期间 /api/* 反代到本地 Fastify 后端（端口 3001）。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.versions.node': '"20"',
  },
  resolve: {
    alias: [
      {
        find: /(^|\/)fengari\/src\/lualib\.js$/,
        replacement: fengariLualibShim,
      },
      {
        find: 'os',
        replacement: osShim,
      },
      {
        find: 'fs',
        replacement: fsShim,
      },
      {
        find: 'tmp',
        replacement: tmpShim,
      },
      {
        find: 'child_process',
        replacement: childProcessShim,
      },
      {
        find: 'readline-sync',
        replacement: readlineSyncShim,
      },
    ],
  },
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
