import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TriangleAlert, Check, Home } from 'lucide-react';
import { getAdminAccess } from '../services/api';
import MigrationManager from './admin/MigrationManager';

const EmergencyAccessModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState('token');
    const [emergencyToken, setEmergencyToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [adminUser, setAdminUser] = useState(null);

    const handleEmergencyAccess = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await getAdminAccess({ emergency_token: emergencyToken });
            
            if (response.success) {
                setAdminUser(response.admin_user);
                setSuccess('Emergency access granted successfully!');
                setStep('migrations');
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

    const handleTryNormalLogin = async () => {
        if (onSuccess && adminUser) {
            onSuccess(adminUser);
        }
        onClose();
    };

    const handleProcessingStatus = (isProcessing) => {
        setIsLoading(isProcessing);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                        <TriangleAlert className="w-6 h-6 text-red-500 mr-3" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Emergency Database Access
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <AnimatePresence mode="wait">
                        {step === 'token' && (
                            <motion.div
                                key="token"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong>Warning:</strong> This is for emergency use only when normal login fails due to database issues.
                                    </p>
                                </div>

                                <form onSubmit={handleEmergencyAccess}>
                                    <div className="mb-4">
                                        <label htmlFor="emergencyToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Emergency Access Token
                                        </label>
                                        <input
                                            type="password"
                                            id="emergencyToken"
                                            value={emergencyToken}
                                            onChange={(e) => setEmergencyToken(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                                            placeholder="Enter emergency token"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            This token should be configured in your environment variables.
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded">
                                            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                                        </div>
                                    )}

                                    {success && (
                                        <div className="p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded">
                                            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                                        </div>
                                    )}

                                    <div className="flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                            disabled={isLoading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading || !emergencyToken}
                                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? 'Accessing...' : 'Emergency Access'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}

                        {step === 'migrations' && (
                            <motion.div
                                key="migrations"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>Emergency Access Active:</strong> You now have admin access to manage database migrations and backups.
                                    </p>
                                </div>

                                {/* Full Migration Manager Component */}
                                <MigrationManager 
                                    setProcessingStatus={handleProcessingStatus}
                                    selectedBackup={null}
                                    setSelectedBackup={() => {}}
                                />

                                {/* Action Buttons */}
                                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={handleTryNormalLogin}
                                        className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                    >
                                        <Home className="w-4 h-4 mr-2" />
                                        Try Normal Login
                                    </button>
                                    
                                    <button
                                        onClick={onClose}
                                        className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        Close Emergency Access
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default EmergencyAccessModal; 