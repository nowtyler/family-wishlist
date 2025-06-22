import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, X, Calendar, UserRound, Loader, Check, Home, Plus
} from 'lucide-react';
import { 
  updateUserProfile,
  getAllHouseholds,
  createHouseholdAsUser,
  joinHousehold,
  leaveHousehold
} from '../services/api';
import { useAppContext } from '../contexts/AppContext';
import { toast } from 'react-toastify';
import { validatePassword, validatePasswordMatch } from '../utils/passwordValidation';

const UserProfileModal = ({ isOpen, onClose }) => {
  const { selectedUser, refreshFamilyMembers } = useAppContext();
  const [formData, setFormData] = useState({
    name: '',
    birthday: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);

  // Household management states
  const [households, setHouseholds] = useState([]);
  const [userHouseholds, setUserHouseholds] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [isLoadingHouseholds, setIsLoadingHouseholds] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && selectedUser) {
      setFormData({
        name: selectedUser.name || '',
        birthday: selectedUser.birthday || '',
        username: selectedUser.username || '',
        email: selectedUser.email || '',
        password: '',
        confirmPassword: ''
      });
      setError('');
      fetchHouseholds();
    }
  }, [isOpen, selectedUser]);

  const fetchHouseholds = async () => {
    setIsLoadingHouseholds(true);
    try {
      const response = await getAllHouseholds();
      setHouseholds(response.data || []);
      // Filter out the households that the user is a member of
      setUserHouseholds(response.data.filter(h => h.members?.some(m => m.id === selectedUser.id)) || []);
    } catch (err) {
      console.error('Failed to fetch households:', err);
      toast.error('Failed to load households');
    } finally {
      setIsLoadingHouseholds(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        if (!isLoading) {
          handleClose();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLoading]);

  const handleClose = () => {
    if (isLoading) return;
    setError('');
    onClose();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'username' ? value.toLowerCase() : value
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    
    // Frontend password validation with toast notifications
    if (formData.password) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.error);
        return;
      }
      
      const passwordMatchValidation = validatePasswordMatch(formData.password, formData.confirmPassword);
      if (!passwordMatchValidation.isValid) {
        toast.error(passwordMatchValidation.error);
        return;
      }
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const updateData = {
        name: formData.name.trim(),
        birthday: formData.birthday || null,
        username: formData.username.trim(),
        email: formData.email || null,
      };
      
      // Only include password if it was filled
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      await updateUserProfile(selectedUser.id, updateData);
      
      // Try to update the global state
      try {
        if (typeof refreshFamilyMembers === 'function') {
          await refreshFamilyMembers();
        }
      } catch (refreshErr) {
        console.error("Note: Global family member refresh failed, but local data is updated");
      }
      
      toast.success('Profile updated successfully');
      handleClose();
    } catch (err) {
      console.error("Failed to update profile:", err);
      const errorMessage = err.response?.data?.detail || 'Failed to update profile. Please try again.';
      
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

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;

    setIsLoading(true);
    try {
      const response = await createHouseholdAsUser({ name: newHouseholdName.trim() });
      setHouseholds(prev => [...prev, response.data]);
      setUserHouseholds(prev => [...prev, response.data]);
      setNewHouseholdName('');
      setShowCreateForm(false);
      toast.success('Household created successfully');
    } catch (err) {
      console.error('Failed to create household:', err);
      toast.error('Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async (householdId) => {
    setIsLoading(true);
    try {
      await joinHousehold(householdId);
      const household = households.find(h => h.id === householdId);
      setUserHouseholds(prev => [...prev, household]);
      toast.success('Successfully joined household');
    } catch (err) {
      console.error('Failed to join household:', err);
      toast.error('Failed to join household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveHousehold = async (householdId) => {
    setIsLoading(true);
    try {
      await leaveHousehold(householdId);
      setUserHouseholds(prev => prev.filter(h => h.id !== householdId));
      toast.success('Successfully left household');
    } catch (err) {
      console.error('Failed to leave household:', err);
      toast.error('Failed to leave household');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Edit Profile
                </h3>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                    required
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Birthday (optional)
                  </label>
                  <input
                    type="date"
                    name="birthday"
                    value={formData.birthday}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="user@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password <span className="text-gray-400">(leave blank to keep current)</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Change password (optional)"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm Password <span className="text-gray-400">(leave blank to keep current)</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Confirm new password (optional)"
                    autoComplete="new-password"
                  />
                </div>

                {/* Household Management Section */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Household Memberships
                  </h4>

                  {isLoadingHouseholds ? (
                    <div className="flex justify-center py-4">
                      <Loader className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Current Households */}
                      {userHouseholds.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Your Households
                          </h5>
                          {userHouseholds.map(household => (
                            <div
                              key={household.id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div className="flex items-center">
                                <Home className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {household.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLeaveHousehold(household.id)}
                                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Leave
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Available Households */}
                      {households.filter(h => !userHouseholds.some(uh => uh.id === h.id)).length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Available Households
                          </h5>
                          {households
                            .filter(h => !userHouseholds.some(uh => uh.id === h.id))
                            .map(household => (
                              <div
                                key={household.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex items-center">
                                  <Home className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {household.name}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleJoinHousehold(household.id)}
                                  className="text-sm text-primary hover:text-primary-dark"
                                >
                                  Join
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Create New Household */}
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
                              disabled={isLoading}
                              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                            >
                              {isLoading ? 'Creating...' : 'Create'}
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
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserProfileModal; 