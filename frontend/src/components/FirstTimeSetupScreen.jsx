import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { firstTimeSetup } from '../services/api';

const FirstTimeSetupScreen = () => {
  const [formData, setFormData] = useState({
    admin_username: 'Admin',
    admin_password: '',
    admin_password_confirm: '',
    admin_email: '',
    admin_name: 'Admin'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emergencyKey, setEmergencyKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  const { login, setSelectedUser } = useAppContext();
  const navigate = useNavigate();

  const validatePassword = (password) => {
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 10;
    return hasNumber && hasSpecial && hasMinLength;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'admin_username' || name === 'admin_name') {
      return; // These fields are read-only
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate password
    if (!validatePassword(formData.admin_password)) {
      setError('Password must be at least 10 characters long and include at least one number and one special character.');
      return;
    }

    // Check password confirmation
    if (formData.admin_password !== formData.admin_password_confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await firstTimeSetup({
        admin_username: formData.admin_username,
        admin_password: formData.admin_password,
        admin_email: formData.admin_email,
        admin_name: formData.admin_name
      });
      setEmergencyKey(response.emergency_access_key);
      setSuccess('System setup completed successfully! Please save your emergency access key.');
      login(true);
      setSelectedUser(response.admin_user);
    } catch (err) {
      console.error('Setup error:', err);
      setError(err.response?.data?.detail || err.message || 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleContinue = () => {
    navigate('/admin');
    window.location.reload(); // Force reload to ensure proper state
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          First Time Setup
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Create your admin account to get started
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!emergencyKey ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="admin_username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <div className="mt-1">
                  <input
                    id="admin_username"
                    name="admin_username"
                    type="text"
                    required
                    value={formData.admin_username}
                    readOnly
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="admin_password"
                    name="admin_password"
                    type="password"
                    required
                    value={formData.admin_password}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Password must be at least 10 characters long and include at least one number and one special character.
                </p>
              </div>

              <div>
                <label htmlFor="admin_password_confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <div className="mt-1">
                  <input
                    id="admin_password_confirm"
                    name="admin_password_confirm"
                    type="password"
                    required
                    value={formData.admin_password_confirm}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="admin_email"
                    name="admin_email"
                    type="email"
                    required
                    value={formData.admin_email}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Display Name
                </label>
                <div className="mt-1">
                  <input
                    id="admin_name"
                    name="admin_name"
                    type="text"
                    value={formData.admin_name}
                    readOnly
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                  <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-900"
                >
                  {isLoading ? 'Setting up...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="rounded-md bg-green-50 dark:bg-green-900/50 p-4">
                <div className="text-sm text-green-700 dark:text-green-200">{success}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Emergency Access Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={emergencyKey}
                    readOnly
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Please save this key in a secure location. You will need it for emergency access if you get locked out.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
                >
                  Continue to Admin Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstTimeSetupScreen; 