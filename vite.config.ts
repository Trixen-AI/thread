import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const API = process.env.MESH_API_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // Reachable from other devices on the network, so two people can actually
    // sign in from two machines and message each other.
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/ws': { target: API, ws: true, changeOrigin: true },
    },
    watch: {
      // The server directory is not part of the client bundle, and SQLite
      // rewrites its WAL file on every request — watching it would reload the
      // page in a loop for as long as the app is talking to the API.
      ignored: ['**/server/**'],
    },
  },
})
