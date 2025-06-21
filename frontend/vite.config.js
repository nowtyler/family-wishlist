// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Load environment variables
const environment = process.env.ENVIRONMENT || 'prod';
const isDev = environment === 'dev';

console.log(`Building for environment: ${environment}`);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Default Vite port
    host: '0.0.0.0', // Changed for Docker compatibility
    proxy: {
      // Proxy API requests to the correct backend container based on environment
      '/api': {
        target: isDev ? 'http://dev-backend:8000' : 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''), // Remove /api prefix before forwarding
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
    outDir: 'dist', // Output directory for production build
    // Pass environment variables to the client
    define: {
      'import.meta.env.ENVIRONMENT': JSON.stringify(environment),
      'import.meta.env.IS_DEV_ENV': isDev
    }
  }
})