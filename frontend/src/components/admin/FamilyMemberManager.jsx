import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Pencil, Save, Trash2, X, AlertTriangle, Calendar, 
  Check, Loader, UserRound, ChevronRight 
} from 'lucide-react';
import { 
  getFamilyMembers, 
  createFamilyMember, 
  updateFamilyMember, 
  deleteFamilyMember 
} from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';

const FamilyMemberManager = ({ isOpen, onClose }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [editMemberId, setEditMemberId] = useState(null);
  
  // Store form data for new and edited members
  const [formData, setFormData] = useState({
    name: '',
    birthday: ''
  });
  
  // User selection and actions
  const [selectedMember, setSelectedMember] = useState(null);
  const [actionType, setActionType] = useState(null); // 'edit' or 'delete'
  const [actionConfirm, setActionConfirm] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const modalRef = useRef(null);
  const { refreshFamilyMembers } = useAppContext();

  // Fetch family members on component mount
  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen]);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        // Don't close if we're in the middle of an operation
        if (!saveLoading && !deleteLoading) {
          handleClose();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [saveLoading, deleteLoading]);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Use imported function from api.js
      const response = await getFamilyMembers();
      setMembers(response.data);
    } catch (err) {
      console.error("Failed to fetch family members:", err);
      setError('Failed to load family members. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    // Don't allow closing if operations are in progress
    if (saveLoading || deleteLoading) return;
    
    // Clear all states
    resetStates();
    onClose();
  };

  const resetStates = () => {
    setAddMode(false);
    setEditMemberId(null);
    setFormData({ name: '', birthday: '' });
    setSelectedMember(null);
    setActionType(null);
    setActionConfirm(false);
  };
  
  const handleMemberClick = (member) => {
    // Toggle selection
    if (selectedMember?.id === member.id) {
      setSelectedMember(null);
      setActionType(null);
      setActionConfirm(false);
    } else {
      setSelectedMember(member);
      setActionType(null);
      setActionConfirm(false);
    }
  };
  
  const handleActionClick = (action) => {
    if (!selectedMember) return;
    
    if (action === 'edit') {
      setFormData({
        name: selectedMember.name,
        birthday: selectedMember.birthday || ''
      });
      setEditMemberId(selectedMember.id);
      setActionType('edit');
    } else if (action === 'delete') {
      if (actionType === 'delete' && !actionConfirm) {
        setActionConfirm(true);
      } else {
        setActionType('delete');
        setActionConfirm(false);
      }
    }
  };
  
  const handleAddClick = () => {
    setAddMode(true);
    setSelectedMember(null);
    setEditMemberId(null);
    setActionType(null);
    setFormData({ name: '', birthday: '' });
  };
  
  const handleCancelAction = () => {
    if (addMode) {
      setAddMode(false);
    } else if (editMemberId) {
      setEditMemberId(null);
    }
    setFormData({ name: '', birthday: '' });
    setActionType(null);
    setActionConfirm(false);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    const memberData = {
      name: formData.name.trim(),
      birthday: formData.birthday || null
    };
    
    setSaveLoading(true);
    
    try {
      // If editing existing member
      if (editMemberId) {
        await updateFamilyMember(editMemberId, memberData);
      } 
      // If adding new member
      else if (addMode) {
        await createFamilyMember(memberData);
      }
      
      // Refresh the list
      await fetchMembers();
      
      // If global refresh function exists, call it
      if (typeof refreshFamilyMembers === 'function') {
        try {
          await refreshFamilyMembers();
        } catch (refreshErr) {
          console.error("Failed to refresh family members globally:", refreshErr);
          // Continue since we already fetched members locally
        }
      }
      
      // Reset form state
      setFormData({ name: '', birthday: '' });
      setEditMemberId(null);
      setAddMode(false);
      setActionType(null);
      setActionConfirm(false);
      setSelectedMember(null);
      setError('');
    } catch (err) {
      console.error("Failed to save family member:", err);
      setError(err.response?.data?.detail || 'Failed to save changes. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!selectedMember) return;
    
    setDeleteLoading(true);
    
    try {
      await deleteFamilyMember(selectedMember.id);
      
      // Refresh the list
      await fetchMembers();
      
      // If global refresh function exists, call it
      if (typeof refreshFamilyMembers === 'function') {
        try {
          await refreshFamilyMembers();
        } catch (refreshErr) {
          console.error("Failed to refresh family members globally:", refreshErr);
          // Continue since we already fetched members locally
        }
      }
      
      // Reset states
      setSelectedMember(null);
      setActionType(null);
      setActionConfirm(false);
    } catch (err) {
      console.error("Failed to delete family member:", err);
      setError(err.response?.data?.detail || 'Failed to delete member. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };
  
  // Format date for display (YYYY-MM-DD to Month Day)
  const formatBirthday = (dateString) => {
    if (!dateString) return "No birthday set";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    } catch (err) {
      return dateString;
    }
  };
  
  if (!isOpen) return null;

  return (
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Manage Family Members
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedMember ? 'Select an action or tap another user' : 'Select a user to edit or delete'}
          </p>
        </div>
        
        {/* Content - with scrollable area */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader size={30} className="animate-spin text-primary mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading family members...</p>
            </div>
          ) : (
            <>
              {/* Edit Form */}
              {(editMemberId || addMode) && (
                <div className="mb-6 p-4 border border-blue-100 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                    {addMode ? 'Add New Family Member' : 'Edit Family Member'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Enter family member name"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelAction}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveLoading}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md flex items-center"
                      >
                        {saveLoading ? (
                          <>
                            <Loader size={16} className="animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={16} className="mr-2" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Family Members List */}
              <div className="space-y-2">
                {members.length === 0 ? (
                  <div className="text-center py-12">
                    <UserRound size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No family members found</p>
                  </div>
                ) : (
                  members.map(member => (
                    <div
                      key={member.id}
                      onClick={() => handleMemberClick(member)}
                      className={`p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
                        selectedMember?.id === member.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white flex items-center">
                            {member.name}
                            {member.name.toLowerCase() === 'admin' && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs rounded-full">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                            <Calendar size={12} className="mr-1" />
                            {formatBirthday(member.birthday)}
                            <span className="mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                            <span>{member.wishlist_item_count || 0} items</span>
                          </div>
                        </div>
                        {selectedMember?.id === member.id && (
                          <ChevronRight size={18} className="text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Footer Actions - Sticky */}
        <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <AnimatePresence mode="wait">
            {selectedMember ? (
              <motion.div
                key="member-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-2"
              >
                {actionType === 'delete' && actionConfirm ? (
                  <>
                    {/* Delete confirmation */}
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="flex-1 flex items-center justify-center py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader size={16} className="animate-spin mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} className="mr-2" />
                          Confirm Delete
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelAction}
                      className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* Regular actions */}
                    <button
                      onClick={() => handleActionClick('edit')}
                      className="flex-1 flex items-center justify-center py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                      disabled={selectedMember?.name?.toLowerCase() === 'admin'}
                    >
                      <Pencil size={16} className="mr-2" />
                      Edit
                    </button>
                    
                    {selectedMember?.name?.toLowerCase() !== 'admin' && (
                      <button
                        onClick={() => handleActionClick('delete')}
                        className="flex-1 flex items-center justify-center py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="default-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-2"
              >
                <button
                  onClick={handleAddClick}
                  className="flex-1 flex items-center justify-center py-2.5 px-4 bg-primary hover:bg-primary-dark dark:bg-primary-600 dark:hover:bg-primary-700 text-white rounded-lg"
                  disabled={addMode || editMemberId}
                >
                  <Plus size={16} className="mr-2" />
                  Add New Member
                </button>
                <button
                  onClick={handleClose}
                  className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg"
                >
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FamilyMemberManager;
