import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
const localPath = path => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  base: process.env.STT_EDITOR_BASE || '/source-editor/',
  publicDir: process.env.STT_EDITOR_PUBLIC_DIR || 'public-editor',
  esbuild: {jsx: 'automatic'},
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.versions.node': '"20"',
  },
  resolve: {
    alias: [
      {find: /(^|\/)fengari\/src\/lualib\.js$/, replacement: localPath('./src/lib/node-shims/fengari-lualib.ts')},
      ...['os','fs','tmp','child_process','readline-sync'].map(find => ({find, replacement: localPath('./src/lib/node-shims/'+find+'.ts')})),
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2020',
    reportCompressedSize: false,
    rollupOptions: {input: localPath('./index.html')},
  },
})
