import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Users, Plus, Check, X, ArrowRight, Loader, 
  UserPlus, UserMinus, Settings 
} from 'lucide-react';
import { 
  getAllHouseholds, 
  getUserHouseholds, 
  createHouseholdByUser, 
  joinHousehold, 
  leaveHousehold 
} from '../services/api';
import { toast } from 'react-toastify';

const UserHouseholdManager = ({ 
  isOpen, 
  onClose, 
  onComplete, 
  showSkipOption = false,
  title = "Manage Your Households",
  subtitle = "Join existing households or create new ones"
}) => {
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [userHouseholds, setUserHouseholds] = useState([]);
  const [selectedHouseholds, setSelectedHouseholds] = useState(new Set());
  const [householdsToLeave, setHouseholdsToLeave] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHouseholdData, setNewHouseholdData] = useState({
    name: '',
    description: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const [allHouseholdsResponse, userHouseholdsResponse] = await Promise.all([
        getAllHouseholds(),
        getUserHouseholds()
      ]);
      
      setAllHouseholds(allHouseholdsResponse.data || []);
      setUserHouseholds(userHouseholdsResponse.data?.households || []);
    } catch (err) {
      console.error('Failed to fetch household data:', err);
      setError('Failed to load household information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    if (!newHouseholdData.name.trim()) {
      toast.error('Household name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createHouseholdByUser(newHouseholdData);
      if (response.data.success) {
        toast.success('Household created successfully!');
        await fetchData(); // Refresh data
        setNewHouseholdData({ name: '', description: '' });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error('Failed to create household:', err);
      toast.error(err.response?.data?.detail || 'Failed to create household');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHouseholdToggle = (householdId, isCurrentMember) => {
    if (isCurrentMember) {
      // Toggle leaving household
      setHouseholdsToLeave(prev => {
        const newSet = new Set(prev);
        if (newSet.has(householdId)) {
          newSet.delete(householdId);
        } else {
          newSet.add(householdId);
        }
        return newSet;
      });
    } else {
      // Toggle joining household
      setSelectedHouseholds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(householdId)) {
          newSet.delete(householdId);
        } else {
          newSet.add(householdId);
        }
        return newSet;
      });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      const operations = [];

      // Join selected households
      for (const householdId of selectedHouseholds) {
        operations.push(joinHousehold(householdId));
      }

      // Leave selected households
      for (const householdId of householdsToLeave) {
        operations.push(leaveHousehold(householdId));
      }

      if (operations.length > 0) {
        await Promise.all(operations);
        toast.success('Household memberships updated successfully!');
      }

      onComplete && onComplete();
    } catch (err) {
      console.error('Failed to update household memberships:', err);
      setError(err.response?.data?.detail || 'Failed to update household memberships');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUserMember = (householdId) => {
    return userHouseholds.some(h => h.id === householdId) && !householdsToLeave.has(householdId);
  };

  const getHouseholdStatus = (household) => {
    const isCurrentMember = userHouseholds.some(h => h.id === household.id);
    const willLeave = householdsToLeave.has(household.id);
    const willJoin = selectedHouseholds.has(household.id);

    if (isCurrentMember && !willLeave) return 'member';
    if (isCurrentMember && willLeave) return 'leaving';
    if (!isCurrentMember && willJoin) return 'joining';
    return 'available';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Home className="w-5 h-5" />
                {title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading households...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Create New Household */}
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-green-900 dark:text-green-100">Create New Household</h3>
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="p-2 rounded-full text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                
                <AnimatePresence>
                  {showCreateForm && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleCreateHousehold}
                      className="space-y-3"
                    >
                      <input
                        type="text"
                        placeholder="Household name"
                        value={newHouseholdData.name}
                        onChange={(e) => setNewHouseholdData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={newHouseholdData.description}
                        onChange={(e) => setNewHouseholdData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 flex items-center justify-center py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader size={16} className="animate-spin mr-2" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus size={16} className="mr-2" />
                              Create
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(false)}
                          className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* Existing Households */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Available Households
                </h3>
                
                {allHouseholds.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No households available. Create one to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allHouseholds.map(household => {
                      const status = getHouseholdStatus(household);
                      const isCurrentMember = userHouseholds.some(h => h.id === household.id);
                      
                      return (
                        <div
                          key={household.id}
                          className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                            status === 'member' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' :
                            status === 'joining' ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' :
                            status === 'leaving' ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' :
                            'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          }`}
                          onClick={() => handleHouseholdToggle(household.id, isCurrentMember)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {household.name}
                              </h4>
                              {household.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {household.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {household.member_count || 0} member{(household.member_count || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {status === 'member' && (
                                <span className="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1">
                                  <Check className="w-4 h-4" />
                                  Member
                                </span>
                              )}
                              {status === 'joining' && (
                                <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                                  <UserPlus className="w-4 h-4" />
                                  Will Join
                                </span>
                              )}
                              {status === 'leaving' && (
                                <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                                  <UserMinus className="w-4 h-4" />
                                  Will Leave
                                </span>
                              )}
                              {status === 'available' && (
                                <span className="text-gray-500 dark:text-gray-400 text-sm">
                                  Click to join
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedHouseholds.size > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  Will join {selectedHouseholds.size} household{selectedHouseholds.size !== 1 ? 's' : ''}
                </span>
              )}
              {householdsToLeave.size > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-2">
                  Will leave {householdsToLeave.size} household{householdsToLeave.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            {showSkipOption && (
              <button
                onClick={onComplete}
                className="py-2.5 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (selectedHouseholds.size === 0 && householdsToLeave.size === 0)}
              className="flex-1 flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} className="mr-2" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserHouseholdManager;
