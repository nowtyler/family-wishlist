import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, EyeOff, RefreshCw, Copy, Check, AlertTriangle, 
  Shield, Key, RotateCcw, Save, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  getEmergencyTokenInfo, 
  updateEmergencyToken, 
  generateNewEmergencyToken 
} from '../../services/api';

const EmergencyTokenManager = () => {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTokenInfo();
  }, []);

  const fetchTokenInfo = async () => {
    setIsLoading(true);
    try {
      const response = await getEmergencyTokenInfo();
      setTokenInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch emergency token info:', error);
      toast.error('Failed to load emergency token information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateNewToken = async () => {
    if (!confirm('Are you sure you want to generate a new emergency token? This will invalidate the current token.')) {
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateNewEmergencyToken();
      const newTokenValue = response.data.message.split(': ')[1]; // Extract token from message
      
      toast.success('New emergency token generated successfully');
      setTokenInfo(prev => ({
        ...prev,
        has_token: true,
        updated_at: new Date().toISOString()
      }));
      
      // Show the new token to the user
      setNewToken(newTokenValue);
      setShowToken(true);
      setShowUpdateForm(false);
    } catch (error) {
      console.error('Failed to generate new token:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate new emergency token');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!newToken.trim()) {
      toast.error('Please enter a valid token');
      return;
    }

    setIsUpdating(true);
    try {
      await updateEmergencyToken(newToken.trim());
      toast.success('Emergency token updated successfully');
      setTokenInfo(prev => ({
        ...prev,
        has_token: true,
        updated_at: new Date().toISOString()
      }));
      setShowUpdateForm(false);
      setNewToken('');
    } catch (error) {
      console.error('Failed to update token:', error);
      toast.error(error.response?.data?.detail || 'Failed to update emergency token');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyToken = async () => {
    const tokenToCopy = newToken || (tokenInfo?.token || '');
    try {
      await navigator.clipboard.writeText(tokenToCopy);
      setCopied(true);
      toast.success('Token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
      toast.error('Failed to copy token to clipboard');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading emergency token information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center mb-4">
          <div className="p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
            Emergency Access Token
          </h3>
        </div>

        <div className="space-y-4">
          {/* Token Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center">
              <Key className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Token Status
              </span>
            </div>
            <div className="flex items-center">
              {tokenInfo?.has_token ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Not Set
                </span>
              )}
            </div>
          </div>

          {/* Token Metadata */}
          {tokenInfo?.has_token && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(tokenInfo.created_at)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Updated
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(tokenInfo.updated_at)}
                </p>
              </div>
            </div>
          )}

          {/* Current Token Display */}
          {showToken && newToken && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  New Emergency Token
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyToken}
                    className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                    title="Copy token"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setShowToken(false)}
                    className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                    title="Hide token"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <code className="flex-1 text-sm text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 rounded font-mono break-all">
                  {newToken}
                </code>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                ⚠️ Save this token securely! It will not be shown again.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateNewToken}
              disabled={isGenerating}
              className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-lg transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Generate New Token
                </>
              )}
            </button>

            <button
              onClick={() => setShowUpdateForm(!showUpdateForm)}
              className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Set Custom Token
            </button>

            <button
              onClick={fetchTokenInfo}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Custom Token Form */}
      {showUpdateForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex items-center mb-4">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
              Set Custom Emergency Token
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Emergency Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="Enter new emergency token..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This will replace the current emergency token. Make sure to save the new token securely.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpdateToken}
                disabled={isUpdating || !newToken.trim()}
                className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white rounded-lg transition-colors"
              >
                {isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Update Token
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowUpdateForm(false);
                  setNewToken('');
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EmergencyTokenManager; 