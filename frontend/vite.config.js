// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Load environment variables
const environment = process.env.ENVIRONMENT || 'prod';
const isDev = environment === 'dev';
const isLocal = process.env.LOCAL === 'true';

console.log(`Building for environment: ${environment}${isLocal ? ' (local)' : ''}`);

// Determine backend target based on environment
const getBackendTarget = () => {
  if (isLocal) {
    return 'http://localhost:8001';  // Dev backend port
  }
  return isDev ? 'http://dev-backend:8000' : 'http://backend:8000';
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175, // Dev port (avoids conflict with production on 5173)
    host: '0.0.0.0', // Allow external connections
    allowedHosts: 'all',
    proxy: {
      // Proxy API requests to the correct backend based on environment
      '/api': {
        target: getBackendTarget(),
        changeOrigin: true,
        secure: false,
        // Don't rewrite - backend routes already include /api prefix
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