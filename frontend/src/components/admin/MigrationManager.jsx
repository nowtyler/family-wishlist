import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMigrations, upgradeMigration, getBackups, restoreBackup, deleteBackup, getSchemaHash, deleteMigration, resetMigrationState, hardResetMigrations, resetSchemaHash } from '../../services/api';
import { CircleAlert, Database, Archive, Download, RotateCcw, Plus, Trash2, ArrowUp, X, GitMerge, TriangleAlert, Check, RefreshCw } from 'lucide-react';

const MigrationManager = ({ setProcessingStatus = () => {}, selectedBackup, setSelectedBackup }) => {
    const [migrations, setMigrations] = useState([]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [backups, setBackups] = useState([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupError, setBackupError] = useState('');
    const [dbVersion, setDbVersion] = useState('current');
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
    const [deleteBackupFilename, setDeleteBackupFilename] = useState(null);

    // Action states for backup operations
    const [backupAction, setBackupAction] = useState(null); // 'restore' or 'delete'
    const [backupActionConfirm, setBackupActionConfirm] = useState(false);
    const [backupActionLoading, setBackupActionLoading] = useState(false);
    const [backupActionResult, setBackupActionResult] = useState(null); // 'success' or 'failure'

    // Retry mechanism states
    const [backupFetchAttempts, setBackupFetchAttempts] = useState(0);
    const [isRetryingBackups, setIsRetryingBackups] = useState(false);
    const MAX_RETRY_ATTEMPTS = 3;

    const fetchMigrations = async () => {
        try {
            setProcessingStatus(true);
            setLoading(true);
            setError('');
            const migrationsResponse = await getMigrations();

            if (migrationsResponse.data) {
                setMigrations(migrationsResponse.data.available_migrations || []);
                setCurrentVersion(migrationsResponse.data.current_version || 'base');
                
                // Check for multiple heads
                const hasMultipleHeads = migrationsResponse.data.current_version?.includes(',');
                
                // Check for actual pending migrations
                const hasModelChanges = migrationsResponse.data.available_migrations?.some(m => m.version === 'pending');
                const hasNonAppliedMigrations = migrationsResponse.data.available_migrations?.some(
                    m => m.version !== 'pending' && !m.applied
                );
                
                // If we have needs_upgrade but no actual pending migrations or multiple heads,
                // this could be a hash mismatch - try to fix it silently
                if (migrationsResponse.data.needs_upgrade && 
                    !hasMultipleHeads && 
                    !hasModelChanges && 
                    !hasNonAppliedMigrations) {
                    console.log("Possible hash mismatch detected. Attempting silent fix...");
                    // This will run in the background without blocking the UI
                    silentlyResetSchemaHash().catch(console.error);
                }
                
                // Show warning if needs_upgrade is true or we have multiple heads
                if (migrationsResponse.data.needs_upgrade || hasMultipleHeads) {
                    if (hasMultipleHeads) {
                        setError('Multiple migration branches detected. Click upgrade to merge them.');
                    } else if (hasModelChanges) {
                        setError('Schema changes detected. New migrations may be available.');
                    } else if (hasNonAppliedMigrations) {
                        setError('Pending migrations need to be applied. Click upgrade.');
                    } else {
                        // If no specific issues are detected, it might just be a hash mismatch
                        setError('Database needs upgrade. Click upgrade to resolve.');
                    }
                } else {
                    setError(''); // Clear error if no changes needed
                }
            }
        } catch (err) {
            console.error('Migration fetch error:', err);
            setError('Failed to fetch migrations');
        } finally {
            setLoading(false);
            setProcessingStatus(false);
        }
    };

    // Update the existing handleUpgrade function
    const handleUpgrade = async () => {
        try {
            setProcessingStatus(true);
            setLoading(true);
            setError('');
            const response = await upgradeMigration("head");
            if (response.data.success) {
                setCurrentVersion(response.data.new_version);
                setError('');
                await fetchMigrations();
                await fetchBackups();
                alert("Database upgraded successfully!");
            } else {
                setError(response.data.message || 'Upgrade failed');
                alert("Upgrade failed: " + (response.data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Migration upgrade error:', err);
            
            // Show detailed error message from the server if available
            const errorDetail = err.response?.data?.detail || 
                               err.response?.data?.message || 
                               err.message || 
                               'Failed to upgrade database';
            setError(`Upgrade failed: ${errorDetail}`);
            alert(`Upgrade failed: ${errorDetail}`);
            
            // If the error might be related to missing traceback, show a hint
            if (errorDetail.includes("name 'traceback' is not defined")) {
                setError(`Upgrade failed: Python traceback module is not properly imported in the migration service. 
                        Please refresh the page and try again after the server has been updated.`);
            }
        } finally {
            setLoading(false);
            setProcessingStatus(false);
        }
    };

    // Updated fetchBackups to be more resilient
    const fetchBackups = useCallback(async (isRetry = false) => {
        try {
            setProcessingStatus(true);
            setBackupLoading(true);
            
            if (isRetry) {
                setIsRetryingBackups(true);
            }
            
            const response = await getBackups();
            setBackups(response.data.backups || []);
            setBackupError('');
            setBackupFetchAttempts(0); // Reset attempts on success
            
            // Clear any selected backup if it no longer exists
            if (selectedBackup) {
                const stillExists = response.data.backups.some(b => b.filename === selectedBackup.filename);
                if (!stillExists) {
                    setSelectedBackup(null);
                }
            }
        } catch (err) {
            console.error('Backup fetch error:', err);
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch backups';
            setBackupError(`${errorMessage} (attempt ${backupFetchAttempts + 1})`);
            
            // Increment retry counter
            const newAttempts = backupFetchAttempts + 1;
            setBackupFetchAttempts(newAttempts);
            
            // If we haven't reached max retries, try again after a delay
            if (newAttempts < MAX_RETRY_ATTEMPTS && !isRetry) {
                setTimeout(() => {
                    fetchBackups(true);
                }, 3000); // Retry after 3 seconds
            }
        } finally {
            setBackupLoading(false);
            setProcessingStatus(false);
            setIsRetryingBackups(false);
        }
    }, [backupFetchAttempts, selectedBackup, setProcessingStatus, setSelectedBackup]);

    // Modified to separate migrations and backups initialization
    useEffect(() => {
        const initMigrations = async () => {
            setProcessingStatus(true);
            await fetchMigrations();
            setProcessingStatus(false);
        };
        
        initMigrations();
    }, []);
    
    // Separate effect for backups to ensure independent loading
    useEffect(() => {
        fetchBackups();
        
        // Make fetchBackups available globally
        window.refreshBackups = fetchBackups;
        
        // Cleanup
        return () => {
            window.refreshBackups = null;
        };
    }, [fetchBackups]);

    const handleBackupItemClick = (backup) => {
        // Toggle selection or select new backup
        setSelectedBackup(selectedBackup?.filename === backup.filename ? null : backup);
        
        // Reset action states when selecting a new backup
        setBackupAction(null);
        setBackupActionConfirm(false);
        setBackupActionLoading(false);
        setBackupActionResult(null);
    };

    const handleActionClick = (action) => {
        if (!selectedBackup) return;
        
        if (backupAction === action && !backupActionConfirm) {
            // If same action clicked twice, set to confirm state
            setBackupActionConfirm(true);
        } else {
            // First time clicking this action
            setBackupAction(action);
            setBackupActionConfirm(false);
            setBackupActionResult(null);
        }
    };

    const handleActionConfirm = async () => {
        if (!selectedBackup || !backupAction || !backupActionConfirm) return;

        try {
            setBackupActionLoading(true);
            setProcessingStatus(true);
            setBackupError('');

            if (backupAction === 'restore') {
                const response = await restoreBackup(selectedBackup.filename);
                
                if (response.data.requires_migration) {
                    setBackupActionResult('failure');
                    setBackupError('This backup requires migration. Please upgrade the database first.');
                    return;
                }

                if (response.data.success) {
                    setBackupActionResult('success');
                    await fetchMigrations();
                } else {
                    setBackupActionResult('failure');
                    setBackupError(response.data.message);
                }
            } 
            else if (backupAction === 'delete') {
                const result = await deleteBackup(selectedBackup.filename);
                setBackupActionResult('success');
            }
            
            // After 2 seconds, refresh the backup list
            setTimeout(async () => {
                await fetchBackups();
                // After refreshing, reset all action states
                setTimeout(() => {
                    setBackupAction(null);
                    setBackupActionConfirm(false);
                    setBackupActionLoading(false);
                    setBackupActionResult(null);
                    setSelectedBackup(null);
                }, 3000); // Show success/failure for 3 more seconds after refresh
            }, 2000);
        } catch (err) {
            setBackupError(err.response?.data?.detail || err.message || `Failed to ${backupAction} backup`);
            setBackupActionResult('failure');
            
            // Reset after error display
            setTimeout(() => {
                setBackupActionLoading(false);
                setBackupAction(null);
                setBackupActionConfirm(false);
                setBackupActionResult(null);
            }, 5000);
        } finally {
            setBackupActionLoading(false);
            setProcessingStatus(false);
        }
    };

    // Handle delete/restore button clicks based on current state
    const handleActionButtonClick = () => {
        if (backupActionConfirm) {
            handleActionConfirm();
        } else {
            handleActionClick(backupAction);
        }
    };

    // Function to get button styles for action buttons
    const getActionButtonStyles = (type) => {
        // Set base styles based on action type
        let baseStyles = type === 'restore' 
            ? 'bg-blue-500 hover:bg-blue-600'
            : 'bg-red-500 hover:bg-red-600';

        // Add styles based on action state
        if (backupActionLoading) {
            return 'bg-gray-400 cursor-not-allowed';
        } else if (backupActionResult === 'success') {
            return 'bg-green-500';
        } else if (backupActionResult === 'failure') {
            return 'bg-orange-500';
        }
        
        return baseStyles;
    };

    // Get button text based on current state
    const getActionButtonText = () => {
        if (backupActionLoading) {
            return 'Processing...';
        } else if (backupActionResult === 'success') {
            return 'Success!';
        } else if (backupActionResult === 'failure') {
            return 'Failed!';
        } else if (backupActionConfirm) {
            return 'Confirm?';
        } else {
            return backupAction === 'restore' ? 'Restore' : 'Delete';
        }
    };

    // Add the missing handleManualBackupRefresh function
    const handleManualBackupRefresh = async () => {
        if (backupLoading) return; // Prevent multiple simultaneous refreshes
        
        // Reset the fetch attempts counter to give a fresh start
        setBackupFetchAttempts(0);
        setBackupError('');
        await fetchBackups();
    };
    
    // Add the handleHardReset function that was referenced but not defined
    const handleHardReset = async () => {
        if (!confirm("WARNING: This will reset all migration state! This is an emergency function only. Are you absolutely sure?")) {
            return;
        }
        
        if (!confirm("This action cannot be undone. The database migrations will be reset but data will be preserved. Continue?")) {
            return;
        }
        
        try {
            setProcessingStatus(true);
            setLoading(true);
            setError('');
            
            const response = await hardResetMigrations();
            
            if (response.data.success) {
                alert("Migration state has been reset. You will need to upgrade the database again.");
                await fetchMigrations();
            } else {
                setError(response.data.message || 'Hard reset failed');
                alert("Reset failed: " + (response.data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Hard reset error:', err);
            const errorDetail = err.response?.data?.detail || err.message || 'Failed to reset migrations';
            setError(`Reset failed: ${errorDetail}`);
            alert(`Reset failed: ${errorDetail}`);
        } finally {
            setLoading(false);
            setProcessingStatus(false);
        }
    };

    // Add a method to silently reset the schema hash if needed
    const silentlyResetSchemaHash = async () => {
        try {
            // If no migrations are showing as pending, but needs_upgrade is true,
            // this might be a hash mismatch issue
            const response = await resetSchemaHash();
            if (response.data.success) {
                // Refresh the migrations to reflect the new state
                await fetchMigrations();
            }
        } catch (err) {
            // Silently handle errors - this is meant to run in the background
            console.error("Failed to reset schema hash:", err);
        }
    };

    // Determine if we're dealing with multiple heads
    const hasMultipleHeads = currentVersion?.includes(',');
    const buttonIcon = hasMultipleHeads ? <GitMerge size={20} /> : <ArrowUp size={20} />;
    const buttonTitle = hasMultipleHeads ? "Merge migration branches" : "Upgrade database to latest version";
    const actionMessage = hasMultipleHeads ? "Click to merge branches" : "Click to apply pending changes";

    if (loading) return <div>Loading migrations...</div>;

    return (
        <div className="p-4 space-y-8">
            {error && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                        <span>{error}</span>
                        <button 
                            onClick={fetchMigrations}
                            className="ml-2 px-2 py-1 text-sm bg-yellow-100 dark:bg-yellow-900 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    <CircleAlert size={18} />
                    Important Safety Information
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    A backup will be automatically created before each migration. 
                    Backups are stored in the <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 rounded">data/backups</code> directory.
                </p>
            </div>

            <div className="mb-4">
                <p>Current Version: {currentVersion || 'base'}</p>
                
                {/* Add hard reset button for emergencies */}
                {currentVersion?.includes(',') && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <h3 className="flex items-center gap-2 text-red-800 dark:text-red-200 font-medium mb-2">
                            <TriangleAlert size={18} />
                            Migration State Issue Detected
                        </h3>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-3">
                            Multiple migration heads detected. Normal merge attempts have failed. You may need to use the emergency hard reset.
                        </p>
                        <button
                            onClick={handleHardReset}
                            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium flex items-center gap-2"
                            disabled={loading}
                        >
                            <TriangleAlert size={14} />
                            Emergency Hard Reset
                        </button>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                {(migrations.some(m => !m.applied || m.version === "pending") || hasMultipleHeads) && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-blue-800 dark:text-blue-200">
                                    {hasMultipleHeads ? "Migration Branches Need Merging" : "Database Updates Available"}
                                </h3>
                                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                                    {actionMessage}
                                </p>
                            </div>
                            <button
                                onClick={handleUpgrade}
                                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                                disabled={loading}
                                title={buttonTitle}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                ) : buttonIcon}
                            </button>
                        </div>
                    </div>
                )}

                {/* Show migrations list as read-only info */}
                <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Migration History</h3>
                    {migrations.map((migration) => (
                        <div key={migration.version} 
                             className={`p-3 border rounded mb-2 ${
                               migration.applied ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'
                             }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-mono text-sm">{migration.version}</span>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{migration.description}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {migration.applied ? "✓ Applied" : "Pending"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Backups Section - Improved mobile layout with resilience features */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Archive className="text-gray-500" size={20} />
                            Database Backups
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1">
                            Click on a backup to see restore/delete options
                        </p>
                    </div>
                    
                    {/* Add manual refresh button */}
                    <button
                        onClick={handleManualBackupRefresh}
                        disabled={backupLoading}
                        className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${
                            backupLoading 
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40'
                        }`}
                        title="Refresh backup list"
                    >
                        {backupLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin mr-1"></div>
                                <span>{isRetryingBackups ? 'Retrying...' : 'Loading...'}</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={16} />
                                <span>Refresh</span>
                            </>
                        )}
                    </button>
                </div>

                {backupError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                        <div className="flex justify-between items-center">
                            <p className="text-red-600 dark:text-red-300 text-sm">{backupError}</p>
                            <button
                                onClick={handleManualBackupRefresh}
                                disabled={backupLoading}
                                className="text-xs px-2 py-1 bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700/50 disabled:opacity-50"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {backupLoading && backups.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            <div className="w-8 h-8 border-2 border-blue-300 dark:border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            {isRetryingBackups ? 'Retrying backup fetch...' : 'Loading backups...'}
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            {backupError ? 'Unable to load backups' : 'No backups available'}
                        </div>
                    ) : (
                        backups.map((backup) => (
                            <div
                                key={backup.filename}
                                onClick={() => handleBackupItemClick(backup)}
                                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                                    selectedBackup?.filename === backup.filename
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="w-full">
                                    <div className="font-mono text-sm truncate">{backup.filename}</div>
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1 mt-1">
                                        <span>{new Date(backup.created_at || Date.now()).toLocaleString()}</span>
                                        <span>•</span>
                                        <span>{(backup.size_kb || 0).toFixed(1)} KB</span>
                                        <span>•</span>
                                        <span className={`${
                                            !backup.version || backup.version === "unknown" 
                                                ? 'text-gray-400 dark:text-gray-500'
                                                : backup.version === currentVersion 
                                                    ? 'text-green-500 dark:text-green-400'
                                                    : 'text-yellow-500 dark:text-yellow-400'
                                        }`}>
                                            {backup.version || "unknown"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MigrationManager;
