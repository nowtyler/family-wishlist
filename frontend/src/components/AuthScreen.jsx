import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { verifyPassword, loginUser, registerUser, requestPasswordReset, getAdminAccess } from '../services/api';
import { motion } from 'framer-motion';
import EmergencyAccessModal from './EmergencyAccessModal';
import UserHouseholdManager from './UserHouseholdManager';
import { validatePassword, validatePasswordMatch } from '../utils/passwordValidation';
import { toast } from 'react-toastify';

const AuthScreen = () => {
  const navigate = useNavigate();
  
  // Authentication states
  const [authMode, setAuthMode] = useState('login'); // login, register, reset
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [emergencyToken, setEmergencyToken] = useState('');

  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmergencyAccess, setShowEmergencyAccess] = useState(false);
  const [showHouseholdSetup, setShowHouseholdSetup] = useState(false);
  
  const { login, setSelectedUser } = useAppContext();

  const handleEmergencyAccess = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const response = await getAdminAccess({ emergency_token: emergencyToken });
      if (response.success) {
        login(true);
        setSelectedUser(response.admin_user);
        navigate('/admin');
      } else {
        setError(response.message || 'Emergency access failed');
      }
    } catch (err) {
      console.error('Emergency access error:', err);
      setError(err.response?.data?.detail || err.message || 'Emergency access failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Check if this is an emergency access attempt
      if (username.toLowerCase() === 'bypass') {
        const response = await getAdminAccess({ emergency_token: password });
        if (response.success) {
          login(true);
          setSelectedUser(response.admin_user);
          navigate('/admin');
        } else {
          setError(response.message || 'Emergency access failed');
        }
      } else {
        const response = await loginUser(username, password);
        if (response.data.success) {
          // Store user info and login with direct=true
          login(true);
          
          // Use the user object from the response
          if (response.data.user) {
            const userData = {
              ...response.data.user,
              // Ensure these fields are set even if not in response
              is_admin: response.data.user.is_admin || false
            };
            
            // Set the user data first
            setSelectedUser(userData);
            
            // Log the navigation attempt
            console.log('Login successful, redirecting user:', {
              is_admin: userData.is_admin,
              target: userData.is_admin ? '/admin' : '/'
            });
            
            // Redirect admin users to admin page, others to main dashboard
            if (userData.is_admin) {
              navigate('/admin');
            } else {
              navigate('/');
            }
          } else {
            console.error('No user object in login response:', response.data);
            setError('Login failed - invalid response format');
          }
        } else {
          setError(response.data.message || 'Login failed');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || err.userMessage || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Frontend password validation with toast notifications
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error);
      setIsLoading(false);
      return;
    }
    
    const passwordMatchValidation = validatePasswordMatch(password, confirmPassword);
    if (!passwordMatchValidation.isValid) {
      toast.error(passwordMatchValidation.error);
      setIsLoading(false);
      return;
    }
    
    try {
      const userData = {
        username,
        password,
        name,
        email: email || undefined,
        birthday: birthday || undefined
      };
      
      const response = await registerUser(userData);
      if (response.data.success) {
        // Auto-login the user after successful registration
        try {
          const loginResponse = await loginUser(username, password);
          if (loginResponse.data.success && loginResponse.data.user) {
            login(loginResponse.data.user.is_admin);
            setSelectedUser(loginResponse.data.user);
            toast.success('Registration successful! Now let\'s set up your households.');
            setShowHouseholdSetup(true);
          } else {
            // If auto-login fails, just redirect to login
            toast.success('Registration successful! Please log in to continue.');
            setAuthMode('login');
          }
        } catch (loginErr) {
          console.error('Auto-login error:', loginErr);
          toast.success('Registration successful! Please log in to continue.');
          setAuthMode('login');
        }
        
        // Clear form
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setEmail('');
        setBirthday('');
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.detail || err.userMessage || 'Failed to register. Please try again.';
      
      // Check if it's a password validation error from backend
      if (err.response?.data?.detail && err.response.data.detail.includes('Password must be at least 8 characters')) {
        toast.error(err.response.data.detail);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const response = await requestPasswordReset(resetEmail);
      if (response.data.success) {
        setSuccess('If an account with that email exists, password reset instructions have been sent.');
      } else {
        setError(response.data.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.response?.data?.detail || err.userMessage || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHouseholdSetupComplete = () => {
    // After household setup, just close the modal and navigate to main app
    setShowHouseholdSetup(false);
    navigate('/');
  };

  const handleSkipHouseholdSetup = () => {
    // If user skips household setup, just navigate to main app
    setShowHouseholdSetup(false);
    navigate('/');
    toast.info('You can set up households later from your settings.');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to Family Wishlist
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {authMode === 'login' && "Sign in to your account"}
            {authMode === 'register' && "Create your account"}
            {authMode === 'reset' && "Reset your password"}
            {authMode === 'householdSetup' && "Set up your household"}
          </p>
        </div>
        
        {/* Success message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
            <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
          </div>
        )}
        
        {/* Login Form */}
        {authMode === 'login' && (
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder={username.toLowerCase() === 'bypass' ? 'Enter emergency access token' : 'Password'}
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
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
              >
                {isLoading ? 'Signing in...' : (username.toLowerCase() === 'bypass' ? 'Emergency Access' : 'Sign In')}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); setSuccess(''); }}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                New user? Register
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('reset'); setError(''); setSuccess(''); }}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}
        
        {/* Register Form */}
        {authMode === 'register' && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reg-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Choose a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Password must be at least 8 characters with uppercase, lowercase and numbers
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email (optional, for password recovery)
              </label>
              <input
                id="email"
                type="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Birthday (optional)
              </label>
              <input
                id="birthday"
                type="date"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
            )}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
              >
                {isLoading ? 'Registering...' : 'Register'}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}
        
        {/* Password Reset Form */}
        {authMode === 'reset' && (
          <form className="space-y-6" onSubmit={handlePasswordReset}>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username or Email
              </label>
              <input
                id="reset-email"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Enter your username or email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
              />
            </div>
            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
            )}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                Back to login
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Household Setup Modal - Shown after registration */}
      <UserHouseholdManager 
        isOpen={showHouseholdSetup}
        onClose={handleSkipHouseholdSetup}
        onComplete={handleHouseholdSetupComplete}
        showSkipOption={true}
        title="Welcome! Set up your households"
        subtitle="Join existing households or create new ones to get started"
      />
    </motion.div>
  );
};

export default AuthScreen;