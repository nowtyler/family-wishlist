import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { firstTimeSetup } from '../services/api';
import { validatePassword, validatePasswordMatch } from '../utils/passwordValidation';
import { toast } from 'react-toastify';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [passphraseAcknowledged, setPassphraseAcknowledged] = useState(false);
  const [passphraseCopied, setPassphraseCopied] = useState(false);

  const { login, setSelectedUser } = useAppContext();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'admin_username' || name === 'admin_name') {
      return; // These fields are read-only
    }
    setFormData(prev => ({
      ...prev,
      [name]: name === 'admin_username' ? value.toLowerCase() : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Frontend password validation with toast notifications
    const passwordValidation = validatePassword(formData.admin_password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error);
      return;
    }

    const passwordMatchValidation = validatePasswordMatch(formData.admin_password, formData.admin_password_confirm);
    if (!passwordMatchValidation.isValid) {
      toast.error(passwordMatchValidation.error);
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
      setSuccess('System setup completed successfully!');
      toast.success('System setup completed successfully!');
      setIsSetupComplete(true);
      login(true);
      setSelectedUser(response.admin_user);

      // Store recovery passphrase for display
      if (response.recovery_passphrase) {
        setRecoveryPassphrase(response.recovery_passphrase);
      }
    } catch (err) {
      console.error('Setup error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Setup failed';

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

  const handleContinue = () => {
    navigate('/admin');
    window.location.reload(); // Force reload to ensure proper state
  };

  const handleCopyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPassphrase);
      setPassphraseCopied(true);
      toast.success('Passphrase copied to clipboard');
      setTimeout(() => setPassphraseCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = recoveryPassphrase;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setPassphraseCopied(true);
      toast.success('Passphrase copied to clipboard');
      setTimeout(() => setPassphraseCopied(false), 3000);
    }
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
          {!isSetupComplete ? (
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
                  Password must be at least 8 characters with uppercase, lowercase and numbers
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

              {/* Recovery Passphrase Display */}
              {recoveryPassphrase && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Recovery Passphrase
                    </h3>
                  </div>

                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Write this passphrase down and store it somewhere safe. You will need it to reset your admin password if you ever forget it. This passphrase will not be shown again in plaintext.
                  </p>

                  <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-amber-300 dark:border-amber-700">
                    <p className="text-center font-mono text-lg text-gray-900 dark:text-white tracking-wide select-all">
                      {recoveryPassphrase}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPassphrase}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors"
                  >
                    {passphraseCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copy to Clipboard
                      </>
                    )}
                  </button>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={passphraseAcknowledged}
                      onChange={(e) => setPassphraseAcknowledged(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      I have saved my recovery passphrase in a secure location
                    </span>
                  </label>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={recoveryPassphrase && !passphraseAcknowledged}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
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
