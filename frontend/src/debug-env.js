/**
 * Helper utility to log environment info at startup
 */

export function logEnvironmentVariables() {
  // Log all environment variables for debugging
  console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
  console.log('Mode:', import.meta.env.MODE);
  console.log('Base URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('Environment:', import.meta.env.ENVIRONMENT || 'Not set');
  console.log('Is Dev Environment:', import.meta.env.IS_DEV_ENV ? 'Yes' : 'No');
  console.log('All env vars: ', import.meta.env);
  console.log('=================================');
}

export const isDevelopmentEnvironment = () => {
  return import.meta.env.IS_DEV_ENV === true ||
         import.meta.env.ENVIRONMENT === 'development' ||
         import.meta.env.ENVIRONMENT === 'dev' ||  // Legacy support
         import.meta.env.MODE === 'development';
};
