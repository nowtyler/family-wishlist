// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import UserSelectionScreen from './components/UserSelectionScreen';
import DashboardScreen from './components/DashboardScreen';
import Navbar from './components/Navbar';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, selectedUser } = useAppContext();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Special case for the dashboard
  if (location.pathname === '/' && !selectedUser) {
    return <Navigate to="/select-user" replace />;
  }
  
  return children;
};

const AppContent = () => {
  const { isAuthenticated, selectedUser } = useAppContext();
  console.log('App State:', { isAuthenticated, selectedUser }); // Debug log

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-gray-800">
        {isAuthenticated && selectedUser && <Navbar />}
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/auth" element={
              isAuthenticated ? <Navigate to="/select-user" replace /> : <AuthScreen />
            } />
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

const App = () => (
  <AppProvider>
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  </AppProvider>
);

export default App;