import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { verifyPassword, loginUser, registerUser, requestPasswordReset, adminResetPassword } from '../services/api';
import { motion } from 'framer-motion';
import UserHouseholdManager from './UserHouseholdManager';
import { validatePassword, validatePasswordMatch } from '../utils/passwordValidation';
import { toast } from 'react-toastify';
import TurnstileWidget from './TurnstileWidget';

const AuthScreen = () => {
  const navigate = useNavigate();
  
  // Authentication states
  const [authMode, setAuthMode] = useState('login'); // login, register, reset, admin-reset
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  // Admin passphrase reset states
  const [adminPassphrase, setAdminPassphrase] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHouseholdSetup, setShowHouseholdSetup] = useState(false);
  const [turnstileTokens, setTurnstileTokens] = useState({
    login: '',
    register: '',
    reset: '',
  });
  const [widgetResetCounter, setWidgetResetCounter] = useState(0);

  const { login, setSelectedUser } = useAppContext();

  const currentMode = useMemo(() => authMode, [authMode]);

  // Reset Turnstile widget and token when switching modes
  const switchAuthMode = (newMode) => {
    setAuthMode(newMode);
    setError('');
    setSuccess('');
    setWidgetResetCounter(prev => prev + 1);
    setTurnstileTokens({
      login: '',
      register: '',
      reset: '',
    });
  };

  // Memoized Turnstile callbacks to prevent infinite re-renders
  const handleLoginVerify = useCallback((token) => {
    setTurnstileTokens((prev) => ({ ...prev, login: token }));
  }, []);

  const handleLoginExpire = useCallback(() => {
    setTurnstileTokens((prev) => ({ ...prev, login: '' }));
  }, []);

  const handleRegisterVerify = useCallback((token) => {
    setTurnstileTokens((prev) => ({ ...prev, register: token }));
  }, []);

  const handleRegisterExpire = useCallback(() => {
    setTurnstileTokens((prev) => ({ ...prev, register: '' }));
  }, []);

  const handleResetVerify = useCallback((token) => {
    setTurnstileTokens((prev) => ({ ...prev, reset: token }));
  }, []);

  const handleResetExpire = useCallback(() => {
    setTurnstileTokens((prev) => ({ ...prev, reset: '' }));
  }, []);

  const handleTurnstileError = useCallback(() => {
    setError('Turnstile verification failed. Please try again.');
  }, []);

  const extractErrorDetail = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;
    if (detail && typeof detail === 'object') {
      return {
        message: detail.message || fallbackMessage,
        turnstileRequired: detail.turnstile_required || false,
      };
    }
    return {
      message: detail || err.userMessage || fallbackMessage,
      turnstileRequired: false,
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isDevelopment = import.meta.env.MODE === 'development' || window.__RUNTIME_ENV__?.mode === 'development';
      // Only require Turnstile token in production
      if (!isDevelopment && !turnstileTokens.login) {
        setError('Please complete the Turnstile challenge before signing in.');
        setIsLoading(false);
        return;
      }
      const response = await loginUser(username, password, turnstileTokens.login);
      if (response.data.success) {
        // Store user info and login with direct=true
        login(true);
        setTurnstileTokens((prev) => ({ ...prev, login: '' }));

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
          console.log('Login successful, user data:', {
            is_admin: userData.is_admin,
            tutorial_status: userData.tutorial_status,
            first_login: userData.first_login,
            household_count: userData.household_count,
            target: userData.is_admin ? '/admin' : '/',
            fullUser: userData
          });

          const hasHousehold = (userData.household_count ?? 0) > 0 || ((userData.households || []).length > 0);

          // Show household setup only for truly new, non-admin users without a household.
          if (userData.tutorial_status === "new" && !hasHousehold && !userData.is_admin) {
            console.log('New user without household detected, showing household setup modal');
            setShowHouseholdSetup(true);
          } else {
            // Redirect admin users to admin page, others to main dashboard
            console.log('Navigating to:', userData.is_admin ? '/admin' : '/');
            if (userData.is_admin) {
              navigate('/admin');
            } else {
              navigate('/');
            }
          }
        } else {
          console.error('No user object in login response:', response.data);
          setError('Login failed - invalid response format');
        }
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      const { message } = extractErrorDetail(
        err,
        'Failed to login. Please try again.'
      );
      setError(message);
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
      const isDevelopment = import.meta.env.MODE === 'development' || window.__RUNTIME_ENV__?.mode === 'development';
      // Only require Turnstile token in production
      if (!isDevelopment && !turnstileTokens.register) {
        setError('Please complete the Turnstile challenge before registering.');
        setIsLoading(false);
        return;
      }
      const userData = {
        username,
        password,
        name,
        email: email || undefined,
        birthday: birthday || undefined,
        turnstile_token: turnstileTokens.register || undefined,
      };
      
      const response = await registerUser(userData);
      if (response.data.success) {
        // Clear form
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setEmail('');
        setBirthday('');
        setTurnstileTokens((prev) => ({ ...prev, register: '' }));

        // Show success message and switch to login mode
        // Note: We don't auto-login to avoid bypassing Turnstile verification
        toast.success('Registration successful! Please log in to continue.');
        setSuccess('Registration successful! Please log in with your new account.');
        switchAuthMode('login');
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      const { message } = extractErrorDetail(
        err,
        'Failed to register. Please try again.'
      );
      
      // Check if it's a password validation error from backend
      if (message.includes('Password must be at least 8 characters')) {
        toast.error(message);
      } else {
        setError(message);
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
      const isDevelopment = import.meta.env.MODE === 'development' || window.__RUNTIME_ENV__?.mode === 'development';
      // Only require Turnstile token in production
      if (!isDevelopment && !turnstileTokens.reset) {
        setError('Please complete the Turnstile challenge before requesting a reset.');
        setIsLoading(false);
        return;
      }
      const response = await requestPasswordReset(resetEmail, turnstileTokens.reset);
      if (response.data.requires_passphrase) {
        // Admin user — switch to passphrase verification form
        setAuthMode('admin-reset');
        setError('');
        setSuccess('');
        setWidgetResetCounter(prev => prev + 1);
        setTurnstileTokens({ login: '', register: '', reset: '' });
      } else if (response.data.success) {
        setSuccess('If an account with that email exists, password reset instructions have been sent.');
        setTurnstileTokens((prev) => ({ ...prev, reset: '' }));
      } else {
        setError(response.data.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      const { message } = extractErrorDetail(
        err,
        'Failed to request password reset.'
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminPassphraseReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate password
    const passwordValidation = validatePassword(adminNewPassword);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error);
      return;
    }

    const passwordMatchValidation = validatePasswordMatch(adminNewPassword, adminConfirmPassword);
    if (!passwordMatchValidation.isValid) {
      toast.error(passwordMatchValidation.error);
      return;
    }

    if (!adminPassphrase.trim()) {
      setError('Please enter your recovery passphrase.');
      return;
    }

    setIsLoading(true);

    try {
      const isDevelopment = import.meta.env.MODE === 'development' || window.__RUNTIME_ENV__?.mode === 'development';
      if (!isDevelopment && !turnstileTokens.reset) {
        setError('Please complete the Turnstile challenge.');
        setIsLoading(false);
        return;
      }
      const response = await adminResetPassword(adminPassphrase, adminNewPassword, turnstileTokens.reset);
      if (response.data.success) {
        setSuccess('Admin password has been reset successfully. Redirecting to login...');
        setAdminPassphrase('');
        setAdminNewPassword('');
        setAdminConfirmPassword('');
        setTimeout(() => {
          switchAuthMode('login');
        }, 3000);
      } else {
        setError(response.data.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Admin passphrase reset error:', err);
      const { message } = extractErrorDetail(
        err,
        'Failed to reset admin password.'
      );
      setError(message);
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
            {authMode === 'admin-reset' && "Admin password reset"}
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
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
            )}
            <TurnstileWidget
              resetKey={`login-${widgetResetCounter}`}
              onVerify={handleLoginVerify}
              onExpire={handleLoginExpire}
              onError={handleTurnstileError}
            />
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => switchAuthMode('register')}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                New user? Register
              </button>
              <button
                type="button"
                onClick={() => switchAuthMode('reset')}
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
                Email (required, for password recovery) <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
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
            <TurnstileWidget
              resetKey={`register-${widgetResetCounter}`}
              onVerify={handleRegisterVerify}
              onExpire={handleRegisterExpire}
              onError={handleTurnstileError}
            />
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
                onClick={() => switchAuthMode('login')}
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
            <TurnstileWidget
              resetKey={`reset-${widgetResetCounter}`}
              onVerify={handleResetVerify}
              onExpire={handleResetExpire}
              onError={handleTurnstileError}
            />
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
                onClick={() => switchAuthMode('login')}
                className="text-sm font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
              >
                Back to login
              </button>
            </div>
          </form>
        )}

        {/* Admin Passphrase Reset Form */}
        {authMode === 'admin-reset' && (
          <form className="space-y-5" onSubmit={handleAdminPassphraseReset}>
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
              <p className="text-blue-700 dark:text-blue-300 text-xs">
                Enter your recovery passphrase to reset the admin password. This is the passphrase you were given during initial setup.
              </p>
            </div>

            <div>
              <label htmlFor="admin-passphrase" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Recovery Passphrase
              </label>
              <input
                id="admin-passphrase"
                type="text"
                required
                autoComplete="off"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700 font-mono"
                placeholder="word1 word2 word3 word4 word5 word6"
                value={adminPassphrase}
                onChange={(e) => setAdminPassphrase(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="admin-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password
              </label>
              <input
                id="admin-new-password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="New password"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Password must be at least 8 characters with uppercase, lowercase and numbers
              </p>
            </div>

            <div>
              <label htmlFor="admin-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm New Password
              </label>
              <input
                id="admin-confirm-password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm bg-white dark:bg-gray-700"
                placeholder="Confirm new password"
                value={adminConfirmPassword}
                onChange={(e) => setAdminConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
            )}
            <TurnstileWidget
              resetKey={`admin-reset-${widgetResetCounter}`}
              onVerify={handleResetVerify}
              onExpire={handleResetExpire}
              onError={handleTurnstileError}
            />
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
              >
                {isLoading ? 'Resetting...' : 'Reset Admin Password'}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => switchAuthMode('login')}
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
