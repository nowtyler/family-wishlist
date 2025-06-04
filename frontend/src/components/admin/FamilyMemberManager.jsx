import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Save, Trash2, X, AlertTriangle, Calendar, Check, Loader, UserRound } from 'lucide-react';
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
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
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
    
    // Clear form state
    setAddMode(false);
    setEditMemberId(null);
    setFormData({ name: '', birthday: '' });
    setDeleteConfirmId(null);
    onClose();
  };
  
  const handleEditClick = (member) => {
    setEditMemberId(member.id);
    setFormData({
      name: member.name,
      birthday: member.birthday || ''
    });
    setAddMode(false);
  };
  
  const handleCancelEdit = () => {
    setEditMemberId(null);
    setFormData({ name: '', birthday: '' });
  };
  
  const handleAddClick = () => {
    setAddMode(true);
    setEditMemberId(null);
    setFormData({ name: '', birthday: '' });
  };
  
  const handleCancelAdd = () => {
    setAddMode(false);
    setFormData({ name: '', birthday: '' });
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSaveEdit = async () => {
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
      if (refreshFamilyMembers) {
        refreshFamilyMembers();
      }
      
      // Reset form state
      setFormData({ name: '', birthday: '' });
      setEditMemberId(null);
      setAddMode(false);
      setError('');
    } catch (err) {
      console.error("Failed to save family member:", err);
      setError(err.response?.data?.detail || 'Failed to save changes. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };
  
  const handleDeleteClick = (id) => {
    // Set the member ID for confirmation
    setDeleteConfirmId(id);
  };
  
  const handleConfirmDelete = async (id) => {
    setDeleteLoading(true);
    
    try {
      await deleteFamilyMember(id);
      
      // Refresh the list
      await fetchMembers();
      
      // If global refresh function exists, call it
      if (refreshFamilyMembers) {
        refreshFamilyMembers();
      }
      
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete family member:", err);
      setError(err.response?.data?.detail || 'Failed to delete member. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };
  
  // Format date for display (YYYY-MM-DD to Month Day)
  const formatBirthday = (dateString) => {
    if (!dateString) return "Not set";
    
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Family Members
          </h2>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader size={24} className="animate-spin text-primary" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading family members...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {!addMode && (
              <button
                onClick={handleAddClick}
                className="flex items-center space-x-2 text-primary hover:text-primary-dark dark:text-primary-400 dark:hover:text-primary-300 font-medium mb-4"
              >
                <Plus size={18} />
                <span>Add New Family Member</span>
              </button>
            )}
            
            {/* Add new member form */}
            {addMode && (
              <div className="mb-6 p-4 border border-primary-100 dark:border-primary-900/50 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">Add New Family Member</h3>
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
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Birthday (YYYY-MM-DD)
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
                      onClick={handleCancelAdd}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={saveLoading}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark dark:bg-primary-600 dark:hover:bg-primary-700 text-white rounded-md flex items-center"
                    >
                      {saveLoading ? (
                        <>
                          <Loader size={16} className="animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} className="mr-2" />
                          Add Member
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {members.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                No family members found
              </div>
            ) : (
              <div className="space-y-3 divide-y divide-gray-200 dark:divide-gray-700">
                {members.map(member => (
                  <div key={member.id} className="pt-3 first:pt-0">
                    {/* Normal view mode */}
                    {editMemberId !== member.id && deleteConfirmId !== member.id && (
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="font-semibold text-gray-800 dark:text-white">
                              {member.name}
                              {member.name.toLowerCase() === 'admin' && (
                                <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs rounded-full">
                                  ADMIN
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                            <Calendar size={14} className="mr-1" />
                            {member.birthday ? formatBirthday(member.birthday) : "No birthday set"}
                            <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                            <span>{member.wishlist_item_count} items</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditClick(member)}
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                            title="Edit member"
                          >
                            <Pencil size={16} />
                          </button>
                          
                          {/* Only allow delete for non-admin users */}
                          {member.name.toLowerCase() !== 'admin' && (
                            <button
                              onClick={() => handleDeleteClick(member.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                              title="Delete member"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Edit mode */}
                    {editMemberId === member.id && (
                      <div className="p-3 border border-blue-100 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/20 -mx-3">
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
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Birthday (YYYY-MM-DD)
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
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                            
                            <button
                              type="button"
                              onClick={handleSaveEdit}
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
                                  Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Delete confirmation */}
                    {deleteConfirmId === member.id && (
                      <div className="p-3 border border-red-100 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-900/20 -mx-3">
                        <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-400">
                          <AlertTriangle size={18} />
                          <span className="font-medium">Delete {member.name}?</span>
                        </div>
                        
                        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                          This will permanently delete the family member and all of their wishlist items. This action cannot be undone.
                        </p>
                        
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(member.id)}
                            disabled={deleteLoading}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-md flex items-center"
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
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Sticky Close Button */}
        <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={handleClose}
            disabled={saveLoading || deleteLoading}
            className={`w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200 ${
              (saveLoading || deleteLoading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FamilyMemberManager;
