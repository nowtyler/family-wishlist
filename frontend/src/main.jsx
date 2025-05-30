// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Tailwind and global styles

// Debug environment variables before the app renders
console.log('=== MAIN.JSX ENVIRONMENT DEBUG ===')
console.log('Mode:', import.meta.env.MODE)
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL)
console.log('Production:', import.meta.env.PROD)
console.log('Development:', import.meta.env.DEV)
console.log('=================================')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)