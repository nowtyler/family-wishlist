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

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-sky-100">
        {isAuthenticated && selectedUser && <Navbar />}
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <AuthScreen />} />
            <Route 
              path="/select-user" 
              element={
                <ProtectedRoute>
                  <UserSelectionScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  {selectedUser ? <DashboardScreen /> : <Navigate to="/select-user" replace />}
                </ProtectedRoute>
              } 
            />
            {/* Add more routes as needed, e.g., for specific wishlist views if not part of dashboard */}
             <Route path="*" element={<Navigate to={isAuthenticated ? (selectedUser ? "/" : "/select-user") : "/auth"} replace />} />
          </Routes>
        </main>
        <footer className="text-center p-4 text-sm text-gray-500">
          Family Wishlist &copy; {new Date().getFullYear()}
        </footer>
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