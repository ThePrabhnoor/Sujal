import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Flask binds to 0.0.0.0 (IPv4); use IPv4 loopback to avoid localhost
        // resolving to ::1 on macOS when the backend isn't listening on IPv6.
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      }
    }
  }
})

