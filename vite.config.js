import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on all interfaces so you can use localhost, 127.0.0.1, or your LAN IP
    port: 5173,
    strictPort: true, // Keep port fixed so localStorage (same origin) persists across restarts
  }
})