import { log } from './utils/logger';
/**
 * Helper utility to log environment info at startup
 */

export function logEnvironmentVariables() {
  // Log all environment variables for debugging
  log('=== ENVIRONMENT VARIABLES DEBUG ===');
  log('Mode:', import.meta.env.MODE);
  log('Runtime Mode:', window.__RUNTIME_ENV__?.mode || 'Not set');
  log('Base URL:', import.meta.env.VITE_API_BASE_URL);
  log('Environment:', import.meta.env.ENVIRONMENT || 'Not set');
  log('Is Dev Environment:', import.meta.env.IS_DEV_ENV ? 'Yes' : 'No');
  log('All env vars: ', import.meta.env);
  log('Runtime env: ', window.__RUNTIME_ENV__);
  log('=================================');
}

export const isDevelopmentEnvironment = () => {
  return import.meta.env.IS_DEV_ENV === true ||
         import.meta.env.ENVIRONMENT === 'development' ||
         import.meta.env.ENVIRONMENT === 'dev' ||  // Legacy support
         import.meta.env.MODE === 'development' ||
         window.__RUNTIME_ENV__?.mode === 'development';
};
