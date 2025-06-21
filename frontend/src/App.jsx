// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import PasswordResetScreen from './components/PasswordResetScreen';
import AdminPage from './components/AdminPage';
import FirstTimeSetupScreen from './components/FirstTimeSetupScreen';
import Navbar from './components/Navbar';
import { checkSetupStatus } from './services/api';
import { logEnvironmentVariables } from './debug-env';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, selectedUser } = useAppContext();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, selectedUser } = useAppContext();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  if (!selectedUser || !selectedUser.is_admin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState(null);
  const location = useLocation();
  
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkSetupStatus();
        setSetupStatus(status);
      } catch (error) {
        console.error('Failed to check setup status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkStatus();
  }, []);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }
  
  // If setup is not complete and we're not already on the setup page, redirect to setup
  if (setupStatus && !setupStatus.is_setup_complete && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  
  // If setup is complete and we're on the setup page, redirect to auth
  if (setupStatus && setupStatus.is_setup_complete && location.pathname === '/setup') {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <>
      <Routes>
        <Route path="/setup" element={<FirstTimeSetupScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/reset-password" element={<PasswordResetScreen />} />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardScreen />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
};

const App = () => {
  // Log environment variables on app start
  logEnvironmentVariables();
  
  return (
    <Router>
      <ThemeProvider>
        <AppProvider>
          <AppContent />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </AppProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;