// frontend/src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import DashboardScreen from './components/DashboardScreen';
import PasswordResetScreen from './components/PasswordResetScreen';
import AdminPage from './components/AdminPage';
import Navbar from './components/Navbar';
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
  const { isAuthenticated, selectedUser } = useAppContext();
  
  const handleClearWishlist = async () => {
    if (window.refreshWishlistItems) {
      await window.refreshWishlistItems();
    }
  };
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-gray-800">
        {/* Show navbar for authenticated users on main dashboard, not admin page */}
        {isAuthenticated && selectedUser && !selectedUser.is_admin && (
          <Navbar onClearWishlist={handleClearWishlist} />
        )}
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/auth" element={
              isAuthenticated ? <Navigate to="/" replace /> : <AuthScreen />
            } />
            <Route path="/reset-password/:token" element={<PasswordResetScreen />} />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                {selectedUser ? <DashboardScreen /> : <Navigate to="/auth" replace />}
              </ProtectedRoute>
            } />
            <Route path="*" element={
              <Navigate to={
                !isAuthenticated ? "/auth" : "/"
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