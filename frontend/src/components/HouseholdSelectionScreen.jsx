import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Check, X, Loader } from 'lucide-react';
import { getAllHouseholds, createHouseholdAsUser, joinHousehold } from '../services/api';
import { toast } from 'react-toastify';

const HouseholdSelectionScreen = ({ onComplete }) => {
  const [households, setHouseholds] = useState([]);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchHouseholds();
  }, []);

  const fetchHouseholds = async () => {
    try {
      const response = await getAllHouseholds();
      setHouseholds(response.data || []);
    } catch (err) {
      console.error('Failed to fetch households:', err);
      setError('Failed to load households. Please try again.');
      toast.error('Failed to load households');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHouseholdSelect = (householdId) => {
    setSelectedHouseholds(prev => {
      if (prev.includes(householdId)) {
        return prev.filter(id => id !== householdId);
      } else {
        return [...prev, householdId];
      }
    });
  };

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;

    setIsSaving(true);
    try {
      const response = await createHouseholdAsUser({ name: newHouseholdName.trim() });
      setHouseholds(prev => [...prev, response.data]);
      setSelectedHouseholds(prev => [...prev, response.data.id]);
      setNewHouseholdName('');
      setShowCreateForm(false);
      toast.success('Household created successfully');
    } catch (err) {
      console.error('Failed to create household:', err);
      toast.error('Failed to create household');
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      // Join all selected households
      await Promise.all(
        selectedHouseholds.map(householdId => joinHousehold(householdId))
      );
      toast.success('Successfully joined selected households');
      onComplete();
    } catch (err) {
      console.error('Failed to join households:', err);
      toast.error('Failed to join some households');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Join Households
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Select the households you'd like to join or create a new one
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Existing Households */}
            {households.length > 0 && (
              <div className="space-y-2">
                {households.map(household => (
                  <button
                    key={household.id}
                    onClick={() => handleHouseholdSelect(household.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      selectedHouseholds.includes(household.id)
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary text-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center">
                      <Home className="w-5 h-5 mr-3" />
                      <span className="font-medium">{household.name}</span>
                    </div>
                    {selectedHouseholds.includes(household.id) && (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create New Household Form */}
            {showCreateForm ? (
              <form onSubmit={handleCreateHousehold} className="space-y-3">
                <div>
                  <label htmlFor="householdName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Household Name
                  </label>
                  <input
                    type="text"
                    id="householdName"
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700"
                    placeholder="Enter household name"
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    {isSaving ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Household
              </button>
            )}

            {/* Action Buttons */}
            <div className="pt-4 flex space-x-3">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HouseholdSelectionScreen; 