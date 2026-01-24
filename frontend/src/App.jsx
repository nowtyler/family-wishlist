// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TutorialProvider } from './contexts/TutorialContext';
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
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const location = useLocation();
  
  const checkStatus = useCallback(async () => {
    try {
      const status = await checkSetupStatus();
      setSetupStatus(status);
      if (status.rate_limited) {
        setRateLimitInfo({
          retryAfter: status.retry_after,
          message: status.error_message
        });
        setCountdown(status.retry_after);
      } else {
        setRateLimitInfo(null);
        setCountdown(0);
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setSetupStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial setup check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          const newCount = Math.max(0, prev - 1);
          // When countdown reaches 0, check status again
          if (newCount === 0 && rateLimitInfo) {
            checkStatus();
          }
          return newCount;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown, rateLimitInfo, checkStatus]);
  
  const handleRetryClick = useCallback(() => {
    if (countdown === 0) {
      setIsLoading(true);
      checkStatus();
    }
  }, [countdown, checkStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show rate limit message if we're rate limited
  if (rateLimitInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-semibold text-red-600 mb-4">Rate Limit Reached</h2>
          <p className="text-gray-600 mb-4">
            {rateLimitInfo.message}
          </p>
          <div className="mb-6">
            <div className="text-sm text-gray-500">
              Time remaining:
            </div>
            <div className="text-2xl font-mono text-gray-700">
              {countdown} seconds
            </div>
          </div>
          <button
            onClick={handleRetryClick}
            disabled={countdown > 0}
            className={`px-4 py-2 rounded transition-colors ${
              countdown > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {countdown > 0 ? 'Please wait...' : 'Try Again'}
          </button>
          {countdown > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              The button will be enabled when the countdown reaches zero
            </p>
          )}
        </div>
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
        <Route path="/reset-password/:token" element={<PasswordResetScreen />} />
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
          <TutorialProvider>
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
          </TutorialProvider>
        </AppProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;