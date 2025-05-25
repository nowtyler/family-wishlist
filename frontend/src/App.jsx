// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import AuthScreen from './components/AuthScreen';
import UserSelectionScreen from './components/UserSelectionScreen';
import DashboardScreen from './components/DashboardScreen';
import Navbar from './components/Navbar'; // We'll create this

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAppContext();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

const AppContent = () => {
  const { isAuthenticated, selectedUser } = useAppContext();
  console.log('App State:', { isAuthenticated, selectedUser }); // Debug log

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-sky-100">
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
    <AppContent />
  </AppProvider>
);

export default App;