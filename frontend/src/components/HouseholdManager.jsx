import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Plus, X, Save, Loader, Check, UserPlus, UserMinus
} from 'lucide-react';
import { 
  getAllHouseholds,
  createHouseholdAsUser,
  joinHousehold,
  leaveHousehold
} from '../services/api';
import { toast } from 'react-toastify';

const HouseholdManager = ({ isOpen, onClose, onSave, currentUser }) => {
  const [households, setHouseholds] = useState([]);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewHouseholdForm, setShowNewHouseholdForm] = useState(false);
  const [newHouseholdData, setNewHouseholdData] = useState({
    name: '',
    description: ''
  });

  // Fetch households on mount
  useEffect(() => {
    if (isOpen) {
      fetchHouseholds();
    }
  }, [isOpen]);

  const fetchHouseholds = async () => {
    setIsLoading(true);
    try {
      const response = await getAllHouseholds();
      setHouseholds(response.data || []);
      
      // If we have a current user, pre-select their households
      if (currentUser?.households) {
        setSelectedHouseholds(currentUser.households.map(h => h.id));
      }
    } catch (err) {
      console.error('Failed to fetch households:', err);
      setError('Failed to load households');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    if (!newHouseholdData.name.trim()) {
      toast.error('Household name is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await createHouseholdAsUser(newHouseholdData);
      setHouseholds(prev => [...prev, response.data]);
      setSelectedHouseholds(prev => [...prev, response.data.id]);
      setShowNewHouseholdForm(false);
      setNewHouseholdData({ name: '', description: '' });
      toast.success('Household created successfully');
    } catch (err) {
      console.error('Failed to create household:', err);
      toast.error(err.response?.data?.detail || 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHouseholdSelection = async (householdId) => {
    setIsLoading(true);
    try {
      if (selectedHouseholds.includes(householdId)) {
        // Leave household
        await leaveHousehold(householdId);
        setSelectedHouseholds(prev => prev.filter(id => id !== householdId));
        toast.success('Left household successfully');
      } else {
        // Join household
        await joinHousehold(householdId);
        setSelectedHouseholds(prev => [...prev, householdId]);
        toast.success('Joined household successfully');
      }
    } catch (err) {
      console.error('Failed to update household membership:', err);
      toast.error(err.response?.data?.detail || 'Failed to update household membership');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(selectedHouseholds);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Manage Households
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Join existing households or create a new one
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Create New Household Form */}
          {showNewHouseholdForm ? (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Create New Household
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHouseholdData.name}
                    onChange={(e) => setNewHouseholdData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter household name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newHouseholdData.description}
                    onChange={(e) => setNewHouseholdData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter household description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowNewHouseholdForm(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateHousehold}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {isLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewHouseholdForm(true)}
              className="mb-6 w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Plus size={20} />
              Create New Household
            </button>
          )}

          {/* Households List */}
          <div className="space-y-3">
            {households.map(household => (
              <div
                key={household.id}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {household.name}
                    </h4>
                    {household.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {household.description}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {household.member_count} member{household.member_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleHouseholdSelection(household.id)}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedHouseholds.includes(household.id)
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                    }`}
                  >
                    {selectedHouseholds.includes(household.id) ? (
                      <UserMinus size={20} />
                    ) : (
                      <UserPlus size={20} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isLoading ? (
                <>
                  <Loader size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HouseholdManager; 