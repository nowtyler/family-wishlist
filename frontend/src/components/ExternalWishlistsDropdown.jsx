import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink, Plus, Edit2, Trash2, Check, X, AlertOctagon } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { getExternalWishlists, createExternalWishlist, updateExternalWishlist, deleteExternalWishlist } from '../services/api';

const ExternalWishlistsDropdown = ({ member }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [wishlists, setWishlists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '' });
  const [error, setError] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const { selectedUser } = useAppContext();
  const dropdownRef = useRef(null);
  
  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';
  const canEdit = isAdmin || selectedUser?.id === member.id;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Fetch external wishlists when dropdown is opened
  useEffect(() => {
    if (isOpen && member?.id) {
      fetchWishlists();
    }
  }, [isOpen, member?.id]);
  
  const fetchWishlists = async () => {
    if (!member?.id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await getExternalWishlists(member.id);
      setWishlists(response.data || []);
    } catch (err) {
      console.error('Failed to fetch external wishlists:', err);
      setError('Failed to load external wishlists');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddNew = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Both name and URL are required');
      return;
    }
    
    // Add http:// if missing
    let url = formData.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await createExternalWishlist(member.id, { 
        name: formData.name.trim(), 
        url 
      });
      await fetchWishlists();
      setFormData({ name: '', url: '' });
      setIsAddingNew(false);
    } catch (err) {
      console.error('Failed to add external wishlist:', err);
      setError(err.response?.data?.detail || 'Failed to add wishlist');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdate = async (id) => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Both name and URL are required');
      return;
    }
    
    // Add http:// if missing
    let url = formData.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await updateExternalWishlist(id, { 
        name: formData.name.trim(), 
        url 
      });
      await fetchWishlists();
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update external wishlist:', err);
      setError(err.response?.data?.detail || 'Failed to update wishlist');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async (id) => {
    setIsLoading(true);
    setError('');
    
    try {
      await deleteExternalWishlist(id);
      await fetchWishlists();
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete external wishlist:', err);
      setError(err.response?.data?.detail || 'Failed to delete wishlist');
    } finally {
      setIsLoading(false);
    }
  };
  
  const startEdit = (wishlist) => {
    setFormData({ name: wishlist.name, url: wishlist.url });
    setEditingId(wishlist.id);
    setError('');
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({ name: '', url: '' });
    setError('');
  };
  
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
      >
        <span>External Wishlists</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg z-20"
          >
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                External Wishlists
                {canEdit && !isAddingNew && !editingId && (
                  <button
                    onClick={() => {
                      setIsAddingNew(true);
                      setFormData({ name: '', url: '' });
                    }}
                    className="text-primary hover:text-primary-dark"
                    title="Add new external wishlist"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </h3>
              
              {isLoading && (
                <div className="text-center py-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                </div>
              )}
              
              {error && (
                <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-md mb-3">
                  {error}
                </div>
              )}
              
              {/* Add New Form */}
              {isAddingNew && canEdit && (
                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md mb-3 bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="font-medium text-sm mb-2 text-gray-700 dark:text-gray-300">Add External Wishlist</h4>
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Name (e.g., Amazon, Etsy)"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="URL (e.g., https://amazon.com/...)"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNew}
                      disabled={isLoading}
                      className="px-2 py-1 text-xs text-white bg-primary hover:bg-primary-dark rounded-md"
                    >
                      Add Wishlist
                    </button>
                  </div>
                </div>
              )}
              
              {/* Wishlist List */}
              {wishlists.length === 0 && !isLoading ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-2">
                  No external wishlists {canEdit ? 'added yet.' : 'found.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {wishlists.map(wishlist => (
                    <li 
                      key={wishlist.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-md p-2"
                    >
                      {editingId === wishlist.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md"
                          />
                          <input
                            type="url"
                            value={formData.url}
                            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-500 hover:text-gray-700"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => handleUpdate(wishlist.id)}
                              className="p-1 text-green-500 hover:text-green-700"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                      ) : showConfirmDelete === wishlist.id ? (
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                            Are you sure you want to delete this wishlist?
                          </p>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowConfirmDelete(null)}
                              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(wishlist.id)}
                              className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded-md"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {wishlist.name}
                            </span>
                            <div className="flex items-center space-x-1">
                              <a 
                                href={wishlist.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-blue-500 hover:text-blue-700"
                                title="Open link"
                              >
                                <ExternalLink size={14} />
                              </a>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => startEdit(wishlist)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                    title="Edit"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setShowConfirmDelete(wishlist.id)}
                                    className="p-1 text-red-500 hover:text-red-700"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <a 
                            href={wishlist.url} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 dark:text-gray-400 break-all hover:underline"
                          >
                            {wishlist.url}
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExternalWishlistsDropdown;
