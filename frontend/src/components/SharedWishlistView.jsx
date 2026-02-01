// SharedWishlistView.jsx - Component for viewing and managing shared wishlist items
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Plus, Trash2, Edit2, X, Check, ExternalLink,
  ShoppingCart, MessageCircle, Gift, Users, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getSharedWishlist,
  createSharedWishlistItem,
  updateSharedWishlistItem,
  deleteSharedWishlistItem,
  toggleSharedItemThinking,
  toggleSharedItemPurchased
} from '../services/api';

const SharedWishlistView = ({
  wishlist,
  onBack,
  currentUserId,
  currentUserName,
  isOwner
}) => {
  const [wishlistData, setWishlistData] = useState(wishlist);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Form state for adding/editing items
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    image_url: '',
    priority: 1,
    price: ''
  });

  const loadWishlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getSharedWishlist(wishlist.id);
      setWishlistData(response.data);
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to load shared wishlist:', error);
      toast.error('Failed to load wishlist items');
    } finally {
      setIsLoading(false);
    }
  }, [wishlist.id]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      link: '',
      image_url: '',
      priority: 1,
      price: ''
    });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const response = await createSharedWishlistItem(wishlist.id, formData);
      setItems(prev => [response.data, ...prev]);
      resetForm();
      setShowAddForm(false);
      toast.success('Item added');
    } catch (error) {
      console.error('Failed to add item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleUpdateItem = async (itemId) => {
    if (!editingItem?.title?.trim()) return;

    try {
      const response = await updateSharedWishlistItem(itemId, editingItem);
      setItems(prev => prev.map(i => i.id === itemId ? response.data : i));
      setEditingItem(null);
      toast.success('Item updated');
    } catch (error) {
      console.error('Failed to update item:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await deleteSharedWishlistItem(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item deleted');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleThinking = async (itemId) => {
    try {
      const response = await toggleSharedItemThinking(itemId);
      setItems(prev => prev.map(i => i.id === itemId ? response.data : i));
    } catch (error) {
      console.error('Failed to toggle thinking status:', error);
      toast.error('Cannot mark "thinking about" on items you own');
    }
  };

  const handleTogglePurchased = async (itemId) => {
    try {
      const response = await toggleSharedItemPurchased(itemId);
      setItems(prev => prev.map(i => i.id === itemId ? response.data : i));
    } catch (error) {
      console.error('Failed to toggle purchased status:', error);
      toast.error('Cannot mark items as purchased');
    }
  };

  const formatPrice = (priceInCents) => {
    if (priceInCents === null || priceInCents === undefined) return null;
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const getPriorityLabel = (priority) => {
    const labels = { 0: 'Low', 1: 'Medium', 2: 'High' };
    return labels[priority] || 'Medium';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      0: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      1: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
      2: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
    };
    return colors[priority] || colors[1];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-500" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {wishlistData?.name || wishlist.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{wishlistData?.owner_count || 0} co-owner{(wishlistData?.owner_count || 0) !== 1 ? 's' : ''}</span>
                {isOwner && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600
                    dark:text-purple-400 rounded-full text-xs">
                    You're an owner
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Purchase Visibility Notice for Owners */}
          {isOwner && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border
              border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300
              flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>As a co-owner, you can see which items have been purchased to coordinate gift-giving.</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Add Item Button/Form */}
        {isOwner && (
          <>
            {showAddForm ? (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAddItem}
                className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
              >
                <h3 className="font-medium mb-4 text-gray-900 dark:text-white">Add New Item</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter item name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={2}
                      placeholder="Add details about size, color, etc."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Link</label>
                      <input
                        type="url"
                        value={formData.link}
                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={0}>Low</option>
                      <option value={1}>Medium</option>
                      <option value={2}>High</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                      flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Add Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                      rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </motion.form>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full mb-6 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600
                  rounded-xl text-gray-500 dark:text-gray-400 hover:border-purple-400
                  hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Item
              </button>
            )}
          </>
        )}

        {/* Items List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No items in this wishlist yet.</p>
            {isOwner && <p className="mt-2">Add the first item above!</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <motion.div
                key={item.id}
                layout
                className={`p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm ${
                  item.is_purchased ? 'opacity-60' : ''
                }`}
              >
                <div className="flex gap-4">
                  {/* Image */}
                  {item.image_url && (
                    <div className="w-24 h-24 flex-shrink-0">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getPriorityColor(item.priority)}`}>
                            {getPriorityLabel(item.priority)}
                          </span>
                          {item.price && (
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              {formatPrice(item.price)}
                            </span>
                          )}
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Link
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isOwner && (
                          <>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                        {!isOwner && (
                          <>
                            <button
                              onClick={() => handleToggleThinking(item.id)}
                              className={`p-2 rounded-lg ${
                                item.thinking_about_by_list?.includes(currentUserName)
                                  ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                              }`}
                              title="Thinking about this"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTogglePurchased(item.id)}
                              disabled={item.is_purchased && item.purchased_by !== currentUserName}
                              className={`p-2 rounded-lg ${
                                item.purchased_by === currentUserName
                                  ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
                                  : item.is_purchased
                                    ? 'opacity-50 cursor-not-allowed text-gray-400'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                              }`}
                              title={item.is_purchased ? `Reserved by ${item.purchased_by}` : 'Mark as purchased'}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status Indicators */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.is_purchased && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100
                          dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-xs">
                          <Check className="w-3 h-3" />
                          {item.purchased_by === currentUserName
                            ? 'You purchased this'
                            : `Reserved by ${item.purchased_by}`}
                        </span>
                      )}
                      {item.thinking_about_by_list?.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100
                          dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
                          <MessageCircle className="w-3 h-3" />
                          {item.thinking_about_by_list.join(', ')} thinking about this
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Item</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                  <textarea
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Link</label>
                    <input
                      type="url"
                      value={editingItem.link || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingItem.price ? (editingItem.price / 100).toFixed(2) : ''}
                      onChange={(e) => setEditingItem({
                        ...editingItem,
                        price: e.target.value ? parseFloat(e.target.value) * 100 : null
                      })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                  <select
                    value={editingItem.priority}
                    onChange={(e) => setEditingItem({ ...editingItem, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={0}>Low</option>
                    <option value={1}>Medium</option>
                    <option value={2}>High</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => handleUpdateItem(editingItem.id)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                    rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SharedWishlistView;
