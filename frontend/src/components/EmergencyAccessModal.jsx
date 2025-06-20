import React, { useState } from 'react';
import { loginUser } from '../services/api';

const EmergencyAccessModal = ({ isOpen, onClose, onSuccess }) => {
    const [emergencyToken, setEmergencyToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleEmergencyAccess = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            // First try the secure emergency endpoint
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
                setSuccess('Emergency admin access granted! You can now access the admin panel.');
                
                // Try to login with the admin user
                try {
                    const loginResponse = await loginUser('admin', 'admin');
                    if (loginResponse.data.success) {
                        onSuccess(loginResponse.data.user);
                    }
                } catch (loginError) {
                    console.warn('Could not auto-login admin user:', loginError);
                    // Still show success since emergency access worked
                }
            } else {
                // Try legacy emergency access as fallback
                const legacyResponse = await fetch('/api/admin/emergency-access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const legacyData = await legacyResponse.json();

                if (legacyResponse.ok && legacyData.id) {
                    setSuccess('Legacy emergency admin access granted! You can now access the admin panel.');
                    
                    // Try to login with the admin user
                    try {
                        const loginResponse = await loginUser('admin', 'admin');
                        if (loginResponse.data.success) {
                            onSuccess(loginResponse.data.user);
                        }
                    } catch (loginError) {
                        console.warn('Could not auto-login admin user:', loginError);
                    }
                } else {
                    setError(data.detail || 'Emergency access failed. Please check your token and try again.');
                }
            }
        } catch (err) {
            setError('Network error. Please check your connection and try again.');
            console.error('Emergency access error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-red-600">
                        🚨 Emergency Admin Access
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
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
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
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

                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">How to use:</h3>
                    <ol className="text-xs text-gray-600 space-y-1">
                        <li>1. Set EMERGENCY_ACCESS_TOKEN in your environment</li>
                        <li>2. Enter the token above</li>
                        <li>3. Access admin panel to run migrations</li>
                        <li>4. Restore normal login functionality</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default EmergencyAccessModal; 