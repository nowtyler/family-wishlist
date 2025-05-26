import React, { useState, useEffect } from 'react';
import { getMigrations, upgradeMigration } from '../../services/api';

const MigrationManager = () => {
    const [migrations, setMigrations] = useState([]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchMigrations = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await getMigrations();
            if (response.data) {
                setMigrations(response.data.available_migrations || []);
                setCurrentVersion(response.data.current_version || 'base');
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to fetch migrations');
            console.error('Migration fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (version) => {
        try {
            setLoading(true);
            setError('');
            const response = await upgradeMigration(version);
            if (response.data.success) {
                setCurrentVersion(response.data.new_version);
                await fetchMigrations();
            } else {
                setError(response.data.message || 'Upgrade failed');
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to upgrade database');
            console.error('Migration upgrade error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMigrations();
    }, []);

    if (loading) return <div>Loading migrations...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Database Migrations</h2>
            <div className="mb-4">
                <p>Current Version: {currentVersion || 'base'}</p>
            </div>
            <div className="space-y-2">
                {migrations.map((migration) => (
                    <div key={migration.version} 
                         className={`p-3 border rounded ${migration.applied ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-mono text-sm">{migration.version}</span>
                                <p className="text-sm text-gray-600">{migration.description}</p>
                            </div>
                            {!migration.applied && (
                                <button
                                    onClick={() => handleUpgrade(migration.version)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    disabled={loading}
                                >
                                    Upgrade to this version
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MigrationManager;
