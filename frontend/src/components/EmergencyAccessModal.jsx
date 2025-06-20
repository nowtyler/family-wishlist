import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loginUser, getMigrations, upgradeMigration, getBackups, restoreBackup, deleteBackup } from '../services/api';
import { 
  AlertCircle, Database, Archive, Download, RotateCcw, Plus, Trash2, 
  ArrowUp, X, GitMerge, AlertTriangle, Check, RefreshCw, Shield, 
  Lock, Unlock, Settings, Home
} from 'lucide-react';

const EmergencyAccessModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState('token'); // 'token', 'migrations', 'success'
    const [emergencyToken, setEmergencyToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Migration manager states
    const [migrations, setMigrations] = useState([]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [migrationLoading, setMigrationLoading] = useState(false);
    const [migrationError, setMigrationError] = useState('');
    const [backups, setBackups] = useState([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupError, setBackupError] = useState('');
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
    const [deleteBackupFilename, setDeleteBackupFilename] = useState(null);
    const [backupAction, setBackupAction] = useState(null);
    const [backupActionConfirm, setBackupActionConfirm] = useState(false);
    const [backupActionLoading, setBackupActionLoading] = useState(false);
    const [backupActionResult, setBackupActionResult] = useState(null);
    const [backupFetchAttempts, setBackupFetchAttempts] = useState(0);
    const [isRetryingBackups, setIsRetryingBackups] = useState(false);
    const MAX_RETRY_ATTEMPTS = 3;

    const handleEmergencyAccess = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/emergency/admin-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': '127.0.0.1'
                },
                body: JSON.stringify({ emergency_token: emergencyToken })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess('Emergency admin access granted! You can now manage the database.');
                setStep('migrations');
                await fetchMigrations();
                await fetchBackups();
            } else {
                const legacyResponse = await fetch('/api/admin/emergency-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const legacyData = await legacyResponse.json();

                if (legacyResponse.ok && legacyData.id) {
                    setSuccess('Legacy emergency admin access granted! You can now manage the database.');
                    setStep('migrations');
                    await fetchMigrations();
                    await fetchBackups();
                } else {
                    setError(data.detail || 'Emergency access failed. Please check your token.');
                }
            }
        } catch (err) {
            setError('Network error. Please check your connection and try again.');
            console.error('Emergency access error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMigrations = async () => {
        try {
            setMigrationLoading(true);
            setMigrationError('');
            const response = await getMigrations();

            if (response.data) {
                setMigrations(response.data.available_migrations || []);
                setCurrentVersion(response.data.current_version || 'base');
                
                if (response.data.needs_upgrade) {
                    setMigrationError('Database needs upgrade. Click upgrade to resolve.');
                } else {
                    setMigrationError('');
                }
            }
        } catch (err) {
            console.error('Migration fetch error:', err);
            setMigrationError('Failed to fetch migrations');
        } finally {
            setMigrationLoading(false);
        }
    };

    const handleUpgrade = async () => {
        try {
            setMigrationLoading(true);
            setMigrationError('');
            const response = await upgradeMigration("head");
            if (response.data.success) {
                setCurrentVersion(response.data.new_version);
                setMigrationError('');
                await fetchMigrations();
                await fetchBackups();
                setSuccess('Database upgraded successfully! You can now try normal login.');
                setStep('success');
            } else {
                setMigrationError(response.data.message || 'Upgrade failed');
            }
        } catch (err) {
            console.error('Migration upgrade error:', err);
            const errorDetail = err.response?.data?.detail || err.message || 'Failed to upgrade database';
            setMigrationError(`Upgrade failed: ${errorDetail}`);
        } finally {
            setMigrationLoading(false);
        }
    };

    const fetchBackups = async () => {
        try {
            setBackupLoading(true);
            const response = await getBackups();
            setBackups(response.data.backups || []);
        } catch (err) {
            console.error('Backup fetch error:', err);
        } finally {
            setBackupLoading(false);
        }
    };

    const handleBackupAction = async () => {
        if (!selectedBackup || !backupAction) return;

        try {
            setBackupActionLoading(true);
            if (backupAction === 'restore') {
                const response = await restoreBackup(selectedBackup.filename);
                if (response.data.success) {
                    setSuccess('Backup restored successfully! Database has been reset.');
                    setTimeout(() => setStep('success'), 2000);
                } else {
                    setError('Backup restore failed: ' + (response.data.message || 'Unknown error'));
                }
            } else if (backupAction === 'delete') {
                const response = await deleteBackup(selectedBackup.filename);
                if (response.data.success) {
                    setSelectedBackup(null);
                    await fetchBackups();
                } else {
                    setError('Backup deletion failed: ' + (response.data.message || 'Unknown error'));
                }
            }
        } catch (err) {
            setError('Action failed: ' + (err.message || 'Unknown error'));
        } finally {
            setBackupActionLoading(false);
            setBackupActionConfirm(false);
        }
    };

    const handleTryNormalLogin = async () => {
        try {
            const loginResponse = await loginUser('admin', 'admin');
            if (loginResponse.data.success) {
                onSuccess(loginResponse.data.user);
            } else {
                setError('Normal login still not working. Database may need additional fixes.');
            }
        } catch (loginError) {
            setError('Normal login failed. You may need to use emergency access again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <Shield className="w-6 h-6 text-red-600 mr-3" />
                        <h2 className="text-xl font-bold text-gray-900">
                            🚨 Emergency Admin Access
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <AnimatePresence mode="wait">
                        {step === 'token' && (
                            <motion.div
                                key="token"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Warning:</strong> This is for emergency use only when normal login fails due to database issues.
                                    </p>
                                </div>

                                <form onSubmit={handleEmergencyAccess}>
                                    <div className="mb-4">
                                        <label htmlFor="emergencyToken" className="block text-sm font-medium text-gray-700 mb-2">
                                            Emergency Access Token
                                        </label>
                                        <input
                                            type="password"
                                            id="emergencyToken"
                                            value={emergencyToken}
                                            onChange={(e) => setEmergencyToken(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                            placeholder="Enter emergency token"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            This token should be configured in your environment variables.
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                                            <p className="text-sm text-red-800">{error}</p>
                                        </div>
                                    )}

                                    {success && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                                            <p className="text-sm text-green-800">{success}</p>
                                        </div>
                                    )}

                                    <div className="flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
                                {/* Database Migrations */}
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <div className="flex items-center mb-4">
                                        <Database className="w-5 h-5 text-blue-600 mr-2" />
                                        <h3 className="text-lg font-semibold text-gray-900">Database Migrations</h3>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="text-md font-medium text-gray-900">Current Status</h4>
                                                <p className="text-sm text-gray-600">Version: {currentVersion}</p>
                                            </div>
                                            <button 
                                                onClick={fetchMigrations}
                                                disabled={migrationLoading}
                                                className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-4 h-4 mr-2 ${migrationLoading ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                        </div>
                                        
                                        {migrationError && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                                                <div className="flex items-center">
                                                    <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                                                    <span className="text-red-800 text-sm">{migrationError}</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {migrations.length > 0 && (
                                            <div className="space-y-2">
                                                <h5 className="font-medium text-gray-900">Available Migrations:</h5>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {migrations.map((migration, index) => (
                                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                            <span className="text-sm text-gray-700">{migration.version}</span>
                                                            <span className={`text-xs px-2 py-1 rounded ${
                                                                migration.applied 
                                                                    ? 'bg-green-100 text-green-800' 
                                                                    : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {migration.applied ? 'Applied' : 'Pending'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button
                                            onClick={handleUpgrade}
                                            disabled={migrationLoading || !migrationError}
                                            className="w-full flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {migrationLoading ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                    Upgrading...
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowUp className="w-4 h-4 mr-2" />
                                                    Upgrade Database
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Backup Management */}
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <div className="flex items-center mb-4">
                                        <Archive className="w-5 h-5 text-purple-600 mr-2" />
                                        <h3 className="text-lg font-semibold text-gray-900">Backup Management</h3>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-md font-medium text-gray-900">Available Backups</h4>
                                            <button 
                                                onClick={fetchBackups}
                                                disabled={backupLoading}
                                                className="flex items-center px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-3 h-3 mr-1 ${backupLoading ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                        </div>
                                        
                                        {backups.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {backups.map((backup, index) => (
                                                    <div 
                                                        key={index}
                                                        onClick={() => setSelectedBackup(selectedBackup?.filename === backup.filename ? null : backup)}
                                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                                            selectedBackup?.filename === backup.filename
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center">
                                                                <Archive className="w-4 h-4 text-purple-500 mr-3" />
                                                                <div>
                                                                    <h5 className="font-medium text-gray-900">{backup.filename}</h5>
                                                                    <p className="text-sm text-gray-600">
                                                                        {backup.created_at} • {backup.size}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedBackup(backup);
                                                                        setBackupAction('restore');
                                                                    }}
                                                                    className="text-green-600 hover:text-green-800 text-sm"
                                                                >
                                                                    Restore
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedBackup(backup);
                                                                        setBackupAction('delete');
                                                                    }}
                                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm">No backups available</p>
                                        )}
                                        
                                        {selectedBackup && backupAction && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                                <p className="text-sm text-blue-800 mb-2">
                                                    {backupAction === 'restore' 
                                                        ? `Restore backup: ${selectedBackup.filename}?`
                                                        : `Delete backup: ${selectedBackup.filename}?`
                                                    }
                                                </p>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => setBackupActionConfirm(true)}
                                                        disabled={backupActionLoading}
                                                        className={`flex items-center px-3 py-1 rounded text-sm font-medium transition-colors ${
                                                            backupAction === 'restore' 
                                                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                                                : 'bg-red-500 hover:bg-red-600 text-white'
                                                        } disabled:opacity-50`}
                                                    >
                                                        {backupActionLoading ? 'Processing...' : backupAction === 'restore' ? 'Restore' : 'Delete'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setBackupAction(null);
                                                            setSelectedBackup(null);
                                                        }}
                                                        className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div className="p-4 bg-green-50 border border-green-200 rounded">
                                    <div className="flex items-center">
                                        <Check className="w-5 h-5 text-green-500 mr-2" />
                                        <span className="text-green-800 font-medium">Database issues resolved!</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleTryNormalLogin}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                    >
                                        <Home className="w-4 h-4 mr-2" />
                                        Try Normal Login
                                    </button>
                                    
                                    <button
                                        onClick={() => setStep('migrations')}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Continue Emergency Access
                                    </button>
                                    
                                    <button
                                        onClick={onClose}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                    >
                                        Close Emergency Access
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Action Confirmation Modal */}
                {backupActionConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Confirm {backupAction === 'restore' ? 'Restore' : 'Delete'}
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to {backupAction} the backup "{selectedBackup?.filename}"?
                                {backupAction === 'restore' && ' This will overwrite the current database.'}
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setBackupActionConfirm(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    disabled={backupActionLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBackupAction}
                                    disabled={backupActionLoading}
                                    className={`px-4 py-2 text-white rounded ${
                                        backupAction === 'restore' 
                                            ? 'bg-green-500 hover:bg-green-600' 
                                            : 'bg-red-500 hover:bg-red-600'
                                    } disabled:opacity-50`}
                                >
                                    {backupActionLoading ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmergencyAccessModal; 