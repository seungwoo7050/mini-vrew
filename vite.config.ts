import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
      process: 'process/browser',
      events: 'events',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({ buffer: true }),
        NodeModulesPolyfillPlugin(),
      ]
    }
  },
  define: {
    global: 'globalThis'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },})