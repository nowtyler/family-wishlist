import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ExternalLink, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { getExternalWishlists, createExternalWishlist, updateExternalWishlist, deleteExternalWishlist } from '../services/api';

const ExternalWishlistsButton = ({ member }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [wishlists, setWishlists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '' });
  const [error, setError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null); // Add missing state for delete confirmation
  const { selectedUser } = useAppContext();
  const modalRef = useRef(null);
  
  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';
  const canEdit = isAdmin || selectedUser?.id === member.id;
  
  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Fetch external wishlists when modal is opened
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
      // Ensure we have an array even if the API returns null or undefined
      setWishlists(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch external wishlists:', err);
      setError('Failed to load external wishlists');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a function to validate and format Etsy URLs
  const formatEtsyUrl = (url) => {
    if (!url) return { formattedUrl: '', isValid: false, error: null };
    
    try {
      // Check if it's an Etsy URL
      if (!url.toLowerCase().includes('etsy.com')) {
        return { formattedUrl: url, isValid: true, error: null };
      }
      
      // Add https:// if missing
      let formattedUrl = url;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }
      
      const urlObj = new URL(formattedUrl);
      
      // Check if it follows the expected pattern for Etsy profile URLs
      if (urlObj.hostname.includes('etsy.com')) {
        const pathParts = urlObj.pathname.split('/').filter(part => part);
        
        // Check for people/ followed by a user ID pattern
        if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'people') {
          // Format: https://www.etsy.com/people/USERID
          return {
            formattedUrl: `https://www.etsy.com/people/${pathParts[1]}`,
            isValid: true,
            error: null
          };
        } else if (pathParts.length >= 1 && pathParts[0].toLowerCase() === 'shop') {
          // For shop URLs, provide an informational error
          return {
            formattedUrl: url,
            isValid: false,
            error: "For Etsy, please use the profile URL format: https://www.etsy.com/people/USERID"
          };
        } else {
          // Any other Etsy URL format is probably incorrect
          return {
            formattedUrl: url,
            isValid: false,
            error: "Etsy URLs should follow the format: https://www.etsy.com/people/USERID"
          };
        }
      }
      
      return { formattedUrl: url, isValid: true, error: null };
    } catch (err) {
      console.error("URL parsing error:", err);
      return { 
        formattedUrl: url, 
        isValid: false, 
        error: "Invalid URL format. Please enter a valid URL." 
      };
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, url }));
    
    // Clear any existing URL errors when the user types
    if (urlError) setUrlError('');
    
    // For Etsy URLs, provide immediate feedback
    if (url.toLowerCase().includes('etsy.com')) {
      const { error } = formatEtsyUrl(url);
      if (error) {
        setUrlError(error);
      }
    }
  };

  const handleAddNew = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Both name and URL are required');
      return;
    }
    
    // Process URL for Etsy and other sites
    const { formattedUrl, isValid, error: formatError } = formatEtsyUrl(formData.url);
    
    // Show error if URL format is invalid
    if (!isValid) {
      setUrlError(formatError || "Invalid URL format");
      return;
    }
    
    setIsLoading(true);
    setError('');
    setUrlError('');
    
    try {
      await createExternalWishlist(member.id, { 
        name: formData.name.trim(), 
        url: formattedUrl // Use the formatted URL
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
    
    // Process URL for Etsy and other sites
    const { formattedUrl, isValid, error: formatError } = formatEtsyUrl(formData.url);
    
    // Show error if URL format is invalid
    if (!isValid) {
      setUrlError(formatError || "Invalid URL format");
      return;
    }
    
    setIsLoading(true);
    setError('');
    setUrlError('');
    
    try {
      await updateExternalWishlist(id, { 
        name: formData.name.trim(), 
        url: formattedUrl // Use the formatted URL
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
    setUrlError('');
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({ name: '', url: '' });
    setError('');
    setUrlError('');
  };
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 sm:w-auto w-full justify-center"
        title="External Wishlists"
      >
        <Link2 size={18} className="text-white" />
        <span className="font-medium">External Wishlists</span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto relative"
            >
              <div className="p-4 sm:p-6">
                {/* Remove the X button from the top */}
                
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 pr-8 mb-4">
                  {member.name}'s External Wishlists
                </h3>
                
                {isLoading && (
                  <div className="py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                )}
                
                {error && (
                  <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
                    {error}
                  </div>
                )}
                
                {canEdit && !isAddingNew && !editingId && (
                  <button
                    onClick={() => {
                      setIsAddingNew(true);
                      setFormData({ name: '', url: '' });
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 mb-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                  >
                    <Plus size={16} />
                    <span>Add External Wishlist</span>
                  </button>
                )}
                
                {/* Add New Form */}
                {isAddingNew && canEdit && (
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md mb-4 bg-gray-50 dark:bg-gray-700/50">
                    <h4 className="font-medium text-sm mb-2 text-gray-700 dark:text-gray-300">Add External Wishlist</h4>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Name (e.g., Amazon, Etsy)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <div>
                        <input
                          type="url"
                          value={formData.url}
                          onChange={handleUrlChange}
                          placeholder="URL (e.g., https://amazon.com/...)"
                          className={`w-full px-3 py-2 text-sm border ${urlError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                        />
                        {urlError && (
                          <p className="text-red-500 text-xs mt-1">{urlError}</p>
                        )}
                        {formData.url.toLowerCase().includes('etsy.com') && !urlError && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Etsy format tip: Use https://www.etsy.com/people/USERNAME
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddNew}
                        disabled={isLoading || urlError}
                        className={`px-3 py-1 text-sm text-white rounded-md ${urlError || isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                      >
                        Add Wishlist
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Wishlist List */}
                {!isLoading && (!wishlists || wishlists.length === 0) ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <span>No external wishlists {canEdit ? 'added yet.' : 'found.'}</span>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4">
                    {Array.isArray(wishlists) && wishlists.map(wishlist => (
                      <div 
                        key={wishlist.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
                      >
                        {editingId === wishlist.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            />
                            <div>
                              <input
                                type="url"
                                value={formData.url}
                                onChange={handleUrlChange}
                                className={`w-full px-3 py-2 text-sm border ${urlError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-md bg-white dark:bg-gray-700`}
                              />
                              {urlError && (
                                <p className="text-red-500 text-xs mt-1">{urlError}</p>
                              )}
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-500 hover:text-gray-700"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                              <button
                                onClick={() => handleUpdate(wishlist.id)}
                                className={`p-1 ${urlError ? 'text-gray-400 cursor-not-allowed' : 'text-green-500 hover:text-green-700'}`}
                                title="Save"
                                disabled={urlError}
                              >
                                <Check size={16} />
                              </button>
                            </div>
                          </div>
                        ) : showConfirmDelete === wishlist.id ? (
                          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                              Are you sure you want to delete this wishlist?
                            </p>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setShowConfirmDelete(null)}
                                className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(wishlist.id)}
                                className="px-2 py-1 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                {wishlist.name}
                              </span>
                              <div className="flex items-center space-x-1 ml-2">
                                {canEdit && (
                                  <>
                                    <button
                                      onClick={() => startEdit(wishlist)}
                                      className="p-1 text-gray-500 hover:text-gray-700"
                                      title="Edit"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => setShowConfirmDelete(wishlist.id)}
                                      className="p-1 text-red-500 hover:text-red-700"
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <a 
                              href={wishlist.url} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center mt-2 text-sm text-blue-500 hover:text-blue-700"
                            >
                              <span className="truncate">{wishlist.url}</span>
                              <ExternalLink size={14} className="ml-1 flex-shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add sticky Close button at the bottom */}
                <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExternalWishlistsButton;
