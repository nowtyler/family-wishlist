// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Default Vite port
    host: '0.0.0.0', // Allow access from network (for Docker)
    proxy: {
      // Proxy API requests to the backend container
      '/api': {
        target: 'http://wishlist-backend:8000', // 'backend' is the service name in docker-compose
        changeOrigin: true,
        // secure: false, // If your backend is HTTP
        // rewrite: (path) => path.replace(/^\/api/, ''), // if backend doesn't have /api prefix
      }
    }
  },
  build: {
    outDir: 'dist' // Output directory for production build
  }
})