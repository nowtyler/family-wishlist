// frontend/src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import UserSelectionScreen from './components/UserSelectionScreen';
import DashboardScreen from './components/DashboardScreen';
import PasswordResetScreen from './components/PasswordResetScreen';
import Navbar from './components/Navbar';
import { logEnvironmentVariables } from './debug-env';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, selectedUser, directLogin } = useAppContext();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Special case for the dashboard - if using direct login, go to dashboard with selected user
  // If using legacy auth, go to user selection screen
  if (location.pathname === '/' && !selectedUser) {
    return <Navigate to="/select-user" replace />;
  }
  
  // For user selection screen - if direct login is true, skip to dashboard
  if (location.pathname === '/select-user' && directLogin && selectedUser) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AppContent = () => {
  const { isAuthenticated, selectedUser } = useAppContext();
  
  const handleClearWishlist = async () => {
    if (window.refreshWishlistItems) {
      await window.refreshWishlistItems();
    }
  };
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-gray-800">
        {/* Make sure viewingMember is not passed to Navbar */}
        {isAuthenticated && selectedUser && <Navbar onClearWishlist={handleClearWishlist} />}
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/auth" element={
              isAuthenticated ? <Navigate to="/select-user" replace /> : <AuthScreen />
            } />
            <Route path="/reset-password/:token" element={<PasswordResetScreen />} />
            <Route path="/select-user" element={
              <ProtectedRoute>
                <UserSelectionScreen />
              </ProtectedRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                {selectedUser ? <DashboardScreen /> : <Navigate to="/select-user" replace />}
              </ProtectedRoute>
            } />
            <Route path="*" element={
              <Navigate to={
                !isAuthenticated ? "/auth" : 
                !selectedUser ? "/select-user" : 
                "/"
              } replace />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const App = () => {
  // Log environment variables on app start
  logEnvironmentVariables();
  
  return (
    <AppProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AppProvider>
  );
};

export default App;