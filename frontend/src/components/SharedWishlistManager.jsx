// SharedWishlistManager.jsx - Component for managing shared kid wishlists
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Trash2, Edit2, X, Check, UserPlus, UserMinus,
  ChevronLeft, ChevronRight, Gift, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getSharedWishlists,
  createSharedWishlist,
  updateSharedWishlist,
  deleteSharedWishlist,
  addSharedWishlistOwner,
  removeSharedWishlistOwner
} from '../services/api';

const SharedWishlistManager = ({
  isOpen,
  onClose,
  onSelectWishlist,
  currentUserId
}) => {
  const [wishlists, setWishlists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState(null);
  const [managingOwners, setManagingOwners] = useState(null);
  const [newWishlistName, setNewWishlistName] = useState('');
  const [newWishlistDescription, setNewWishlistDescription] = useState('');
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWishlists = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getSharedWishlists();
      setWishlists(response.data || []);
    } catch (error) {
      console.error('Failed to load shared wishlists:', error);
      toast.error('Failed to load shared wishlists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadWishlists();
    }
  }, [isOpen, loadWishlists]);

  const handleCreateWishlist = async (e) => {
    e.preventDefault();
    if (!newWishlistName.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await createSharedWishlist({
        name: newWishlistName.trim(),
        description: newWishlistDescription.trim() || null
      });
      setWishlists(prev => [...prev, response.data]);
      setNewWishlistName('');
      setNewWishlistDescription('');
      setShowCreateForm(false);
      toast.success('Shared wishlist created');
    } catch (error) {
      console.error('Failed to create shared wishlist:', error);
      toast.error('Failed to create shared wishlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWishlist = async (wishlistId) => {
    if (!editingWishlist?.name?.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await updateSharedWishlist(wishlistId, {
        name: editingWishlist.name.trim(),
        description: editingWishlist.description?.trim() || null
      });
      setWishlists(prev => prev.map(w => w.id === wishlistId ? response.data : w));
      setEditingWishlist(null);
      toast.success('Wishlist updated');
    } catch (error) {
      console.error('Failed to update wishlist:', error);
      toast.error('Failed to update wishlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWishlist = async (wishlistId) => {
    if (!confirm('Are you sure you want to delete this shared wishlist? All items will be removed.')) {
      return;
    }

    try {
      await deleteSharedWishlist(wishlistId);
      setWishlists(prev => prev.filter(w => w.id !== wishlistId));
      toast.success('Shared wishlist deleted');
    } catch (error) {
      console.error('Failed to delete wishlist:', error);
      toast.error('Failed to delete wishlist');
    }
  };

  const handleAddOwner = async (wishlistId) => {
    if (!newOwnerUsername.trim()) return;

    try {
      setIsSubmitting(true);
      await addSharedWishlistOwner(wishlistId, newOwnerUsername.trim());
      await loadWishlists(); // Refresh to get updated owners
      setNewOwnerUsername('');
      toast.success('Co-owner added');
    } catch (error) {
      console.error('Failed to add owner:', error);
      toast.error(error.response?.data?.detail || 'Failed to add co-owner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOwner = async (wishlistId, ownerId) => {
    if (!confirm('Are you sure you want to remove this co-owner?')) {
      return;
    }

    try {
      await removeSharedWishlistOwner(wishlistId, ownerId);
      await loadWishlists(); // Refresh to get updated owners
      toast.success('Co-owner removed');
    } catch (error) {
      console.error('Failed to remove owner:', error);
      toast.error(error.response?.data?.detail || 'Failed to remove co-owner');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Shared Kid Wishlists
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Info Banner */}
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Shared Kid Wishlists</strong> allow multiple parents/guardians to manage a wishlist together.
                Unlike personal wishlists, <strong>all co-owners can see purchased status</strong> to coordinate gift-giving.
              </p>
            </div>

            {/* Create Button / Form */}
            {showCreateForm ? (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleCreateWishlist}
                className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <h3 className="font-medium mb-3 text-gray-900 dark:text-white">Create Shared Wishlist</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Name (e.g., "Emma's Wishlist")
                    </label>
                    <input
                      type="text"
                      value={newWishlistName}
                      onChange={(e) => setNewWishlistName(e.target.value)}
                      placeholder="Enter wishlist name"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      maxLength={200}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newWishlistDescription}
                      onChange={(e) => setNewWishlistDescription(e.target.value)}
                      placeholder="Add a description..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={2}
                      maxLength={2000}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newWishlistName.trim() || isSubmitting}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                        disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewWishlistName('');
                        setNewWishlistDescription('');
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600
                  rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-400
                  hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Shared Wishlist
              </button>
            )}

            {/* Wishlists List */}
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : wishlists.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No shared wishlists yet.</p>
                <p className="text-sm mt-1">Create one to start managing gifts for your kids!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wishlists.map(wishlist => (
                  <motion.div
                    key={wishlist.id}
                    layout
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    {editingWishlist?.id === wishlist.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingWishlist.name}
                          onChange={(e) => setEditingWishlist({ ...editingWishlist, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          maxLength={200}
                        />
                        <textarea
                          value={editingWishlist.description || ''}
                          onChange={(e) => setEditingWishlist({ ...editingWishlist, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateWishlist(wishlist.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingWishlist(null)}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700
                              dark:text-gray-200 rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : managingOwners?.id === wishlist.id ? (
                      // Manage Owners Mode
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Manage Co-Owners: {wishlist.name}
                          </h4>
                          <button
                            onClick={() => setManagingOwners(null)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Current Owners */}
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Current Owners:</p>
                          {wishlist.owners.map(owner => (
                            <div
                              key={owner.id}
                              className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded"
                            >
                              <span className="text-gray-900 dark:text-white">
                                {owner.name}
                                {owner.username && (
                                  <span className="text-gray-500 text-sm ml-1">(@{owner.username})</span>
                                )}
                                {owner.id === wishlist.created_by && (
                                  <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50
                                    text-purple-700 dark:text-purple-300 text-xs rounded-full">
                                    Creator
                                  </span>
                                )}
                              </span>
                              {wishlist.owners.length > 1 && owner.id !== wishlist.created_by && (
                                <button
                                  onClick={() => handleRemoveOwner(wishlist.id, owner.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                  title="Remove co-owner"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add Owner Form */}
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Add Co-Owner:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newOwnerUsername}
                              onChange={(e) => setNewOwnerUsername(e.target.value)}
                              placeholder="Enter username"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                                bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <button
                              onClick={() => handleAddOwner(wishlist.id)}
                              disabled={!newOwnerUsername.trim() || isSubmitting}
                              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm
                                hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center gap-1"
                            >
                              <UserPlus className="w-4 h-4" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => onSelectWishlist(wishlist)}>
                            <h4 className="font-medium text-gray-900 dark:text-white hover:text-purple-600
                              dark:hover:text-purple-400 transition-colors">
                              {wishlist.name}
                            </h4>
                            {wishlist.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {wishlist.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {wishlist.owner_count} owner{wishlist.owner_count !== 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Gift className="w-4 h-4" />
                                {wishlist.item_count} item{wishlist.item_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => setManagingOwners(wishlist)}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                              title="Manage co-owners"
                            >
                              <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => setEditingWishlist(wishlist)}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                              title="Edit wishlist"
                            >
                              <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            {wishlist.created_by === currentUserId && (
                              <button
                                onClick={() => handleDeleteWishlist(wishlist.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                title="Delete wishlist"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                            <button
                              onClick={() => onSelectWishlist(wishlist)}
                              className="p-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg"
                              title="View wishlist"
                            >
                              <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </button>
                          </div>
                        </div>

                        {/* Owners Preview */}
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>Owners:</span>
                            {wishlist.owners.slice(0, 3).map((owner, idx) => (
                              <span key={owner.id}>
                                {owner.name}{idx < Math.min(wishlist.owners.length - 1, 2) ? ', ' : ''}
                              </span>
                            ))}
                            {wishlist.owners.length > 3 && (
                              <span>+{wishlist.owners.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SharedWishlistManager;
