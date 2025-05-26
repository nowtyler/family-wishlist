// frontend/src/components/AuthScreen.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { verifyPassword } from '../services/api';
import { motion } from 'framer-motion';

const AuthScreen = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAppContext();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await verifyPassword(password);
      if (response.data.authenticated) {
        login();
        navigate('/select-user');
      } else {
        setError(response.data.message || 'Incorrect password');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      // Display lockout message if present
      setError(err.response?.data?.detail || err.userMessage || 'Failed to authenticate. Please try again.');
      setPassword(''); // Clear password field on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-slate-800 px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="w-full max-w-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-2xl p-8 space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to Family Wishlist
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Please enter the family password to continue
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <input
              type="password"
              required
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm dark:bg-gray-700"
              placeholder="Family Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Checking...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default AuthScreen;