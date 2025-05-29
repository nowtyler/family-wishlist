// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Default Vite port
    host: '0.0.0.0', // Changed for Docker compatibility
    proxy: {
      // Proxy API requests to the backend container
      '/api': {
        target: 'http://wishlist-backend:8000/api', // Changed back to wishlist-backend:8000
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Remove path rewriting
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to:', req.method, req.url);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist' // Output directory for production build
  }
})