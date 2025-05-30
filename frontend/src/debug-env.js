// A simple file to debug environment variables

// Export a function to log environment variables
export function logEnvironmentVariables() {
  console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
  console.log('Mode:', import.meta.env.MODE);
  console.log('Base URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('All env vars:', import.meta.env);
  console.log('=================================');
  
  return {
    mode: import.meta.env.MODE,
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    allEnv: import.meta.env
  };
}
