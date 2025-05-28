import React, { useState, useEffect } from 'react';
import { getMigrations, upgradeMigration, createBackup, getBackups, restoreBackup, deleteBackup, getSchemaHash, deleteMigration, resetMigrationState, hardResetMigrations } from '../../services/api';
import { AlertCircle, Database, Archive, Download, RotateCcw, Plus, Trash2, ArrowUp, X, GitMerge, AlertTriangle } from 'lucide-react';

const MigrationManager = () => {
    const [migrations, setMigrations] = useState([]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [backups, setBackups] = useState([]);
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupError, setBackupError] = useState('');
    const [dbVersion, setDbVersion] = useState('current');

    const fetchMigrations = async () => {
        try {
            setLoading(true);
            setError('');
            const migrationsResponse = await getMigrations();

            if (migrationsResponse.data) {
                setMigrations(migrationsResponse.data.available_migrations || []);
                setCurrentVersion(migrationsResponse.data.current_version || 'base');
                
                // Check for multiple heads
                const hasMultipleHeads = migrationsResponse.data.current_version?.includes(',');
                
                // Show warning if both needs_upgrade is true or we have multiple heads
                const hasModelChanges = migrationsResponse.data.available_migrations?.some(m => m.version === 'pending');
                if (migrationsResponse.data.needs_upgrade || hasMultipleHeads) {
                    if (hasMultipleHeads) {
                        setError('Multiple migration branches detected. Click upgrade to merge them.');
                    } else if (hasModelChanges) {
                        setError('Schema changes detected. New migrations may be available.');
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
        }
    };

    const handleUpgrade = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await upgradeMigration("head"); // Always upgrade to head
            if (response.data.success) {
                setCurrentVersion(response.data.new_version);
                setError('');
                await fetchMigrations();
                await fetchBackups(); // Refresh backups too since we just created one
            } else {
                setError(response.data.message || 'Upgrade failed');
            }
        } catch (err) {
            console.error('Migration upgrade error:', err);
            
            // Show detailed error message from the server if available
            const errorDetail = err.response?.data?.detail || 
                               err.response?.data?.message || 
                               err.message || 
                               'Failed to upgrade database';
            setError(`Upgrade failed: ${errorDetail}`);
            
            // If the error might be related to missing traceback, show a hint
            if (errorDetail.includes("name 'traceback' is not defined")) {
                setError(`Upgrade failed: Python traceback module is not properly imported in the migration service. 
                        Please refresh the page and try again after the server has been updated.`);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchBackups = async () => {
        try {
            const response = await getBackups();
            setBackups(response.data.backups || []);
        } catch (err) {
            setBackupError(err.response?.data?.detail || err.message || 'Failed to fetch backups');
            console.error('Backup fetch error:', err);
        }
    };

    useEffect(() => {
        fetchMigrations();
        fetchBackups();
        // Remove schema polling
    }, []);

    const handleCreateBackup = async () => {
        try {
            setBackupLoading(true);
            setBackupError('');
            await createBackup();
            await fetchBackups();
        } catch (err) {
            setBackupError(err.response?.data?.detail || err.message || 'Failed to create backup');
        } finally {
            setBackupLoading(false);
        }
    };

    const handleRestoreBackup = async (filename) => {
        if (!confirm('Are you sure you want to restore this backup? Current data will be backed up first.')) {
            return;
        }

        try {
            setBackupLoading(true);
            setBackupError('');
            const response = await restoreBackup(filename);
            
            if (response.data.requires_migration) {
                alert('This backup requires migration. Please upgrade the database first.');
                return;
            }

            if (response.data.success) {
                alert('Backup restored successfully!');
                await fetchMigrations();
                await fetchBackups();
            } else {
                setBackupError(response.data.message);
            }
        } catch (err) {
            setBackupError(err.response?.data?.detail || err.message || 'Failed to restore backup');
        } finally {
            setBackupLoading(false);
        }
    };

    const handleDeleteBackup = async (filename) => {
        if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
            return;
        }

        try {
            setBackupLoading(true);
            setBackupError('');
            await deleteBackup(filename);
            await fetchBackups();
        } catch (err) {
            setBackupError(err.response?.data?.detail || err.message || 'Failed to delete backup');
        } finally {
            setBackupLoading(false);
        }
    };

    const handleDeleteMigration = async (version) => {
        try {
            if (!confirm('Are you sure you want to delete this migration?')) {
                return;
            }
            setLoading(true);
            await deleteMigration(version);
            await fetchMigrations();
        } catch (err) {
            setError('Failed to delete migration');
        } finally {
            setLoading(false);
        }
    };

    const handleHardReset = async () => {
        if (!confirm('WARNING: This will perform a hard reset of the migration state. Only use this as a last resort if normal upgrades are failing. A backup will be created first. Are you sure you want to proceed?')) {
            return;
        }
        
        try {
            setLoading(true);
            setError('');
            const response = await hardResetMigrations();
            if (response.data.success) {
                setCurrentVersion(response.data.new_version);
                setError('');
                alert('Migration state has been hard reset successfully. The database should now be stable.');
                await fetchMigrations();
                await fetchBackups();
            } else {
                setError(response.data.message || 'Hard reset failed');
            }
        } catch (err) {
            console.error('Migration hard reset error:', err);
            setError(`Hard reset failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
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
                        <AlertCircle size={18} />
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
                    <AlertCircle size={18} />
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
                            <AlertTriangle size={18} />
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
                            <AlertTriangle size={14} />
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

            {/* Backups Section */}
            <div className="border-t pt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Archive className="text-gray-500" size={20} />
                        Database Backups
                    </h3>
                    <button
                        onClick={handleCreateBackup}
                        disabled={backupLoading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                        <Plus size={16} />
                        Create Backup
                    </button>
                </div>

                {backupError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                        {backupError}
                    </div>
                )}

                <div className="space-y-2">
                    {backups.map((backup) => (
                        <div
                            key={backup.filename}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-mono text-sm">{backup.filename}</div>
                                    <div className="text-xs text-gray-500 space-x-2">
                                        <span>{new Date(backup.created_at).toLocaleString()}</span>
                                        <span>•</span>
                                        <span>{backup.size_kb.toFixed(1)} KB</span>
                                        <span>•</span>
                                        <span className={`${
                                            backup.version === "unknown" 
                                                ? 'text-gray-400'  // Gray for unknown versions
                                                : backup.version === currentVersion 
                                                    ? 'text-green-500'  // Green for matching versions
                                                    : 'text-yellow-500'  // Yellow only for actual mismatches
                                        }`}>
                                            Version: {backup.version}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleRestoreBackup(backup.filename)}
                                        disabled={backupLoading}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                                            backup.can_restore
                                                ? 'text-blue-500 hover:text-blue-600'
                                                : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                        title={backup.can_restore ? 'Restore this backup' : 'Schema mismatch - requires migration'}
                                    >
                                        <RotateCcw size={14} />
                                        Restore
                                    </button>
                                    <button
                                        onClick={() => handleDeleteBackup(backup.filename)}
                                        disabled={backupLoading}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-red-500 hover:text-red-600"
                                        title="Delete this backup"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {backups.length === 0 && (
                        <div className="text-center py-6 text-gray-500">
                            No backups available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MigrationManager;
