// WishlistCard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, ThumbsUp, Pencil, Check, X } from 'lucide-react';
import { updateWishlistItem } from '../services/api';

function WishlistCard({ member, items, isLoading, isOwnWishlist, currentUserId, onUpdateItems, onDeleteItem, onThinkingAbout }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditForm({
      title: item.title,
      description: item.description || '',
      link: item.link || '',
      image_url: item.image_url || '',
      priority: item.priority
    });
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingItemId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (e, itemId) => {
    e.stopPropagation();
    try {
      // Validate required fields
      if (!editForm.title?.trim()) {
        throw new Error('Title is required');
      }

      // Cleanup form data
      const updatedData = {
        ...editForm,
        title: editForm.title.trim(),
        description: editForm.description?.trim() || null,
        link: editForm.link?.trim() || null,
        image_url: editForm.image_url?.trim() || null,
        priority: Number(editForm.priority)
      };

      await updateWishlistItem(itemId, updatedData);
      await onUpdateItems(); // Wait for the update to complete
      setEditingItemId(null);
      setEditForm({});
    } catch (error) {
      console.error('Failed to update item:', error);
      // You might want to show this error to the user
      // For now, we'll keep the edit form open so they can try again
      alert(error.userMessage || error.message || 'Failed to update item. Please try again.');
    }
  };

  const renderThinkingAbout = (item) => {
    if (isOwnWishlist) return null;
    
    const isThinking = item.thinking_about_by_list?.includes(currentUserId);
    const thinkingCount = item.thinking_about_by_list?.length || 0;
    
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onThinkingAbout(item.id);
          }}
          className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition-colors ${
            isThinking
              ? 'bg-primary text-white'
              : 'text-primary hover:bg-primary/10'
          }`}
        >
          <ThumbsUp size={14} />
          <span>Thinking</span>
          {thinkingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
              {thinkingCount}
            </span>
          )}
        </button>
        {item.thinking_about_by_list?.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {item.thinking_about_by_list.join(', ')}
          </span>
        )}
      </div>
    );
  };

  const renderEditableContent = (item) => (
    <div onClick={e => e.stopPropagation()} className="space-y-3">
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">Title*</label>
        <input
          type="text"
          value={editForm.title}
          onChange={e => setEditForm({ ...editForm, title: e.target.value })}
          className="w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
          required
        />
      </div>
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">Description</label>
        <textarea
          value={editForm.description}
          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
          className="w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
          rows="2"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">Item URL</label>
        <input
          type="url"
          value={editForm.link}
          onChange={e => setEditForm({ ...editForm, link: e.target.value })}
          placeholder="Item URL"
          className="w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">Image URL</label>
        <input
          type="url"
          value={editForm.image_url}
          onChange={e => setEditForm({ ...editForm, image_url: e.target.value })}
          placeholder="Image URL"
          className="w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">Priority</label>
        <select
          value={editForm.priority}
          onChange={e => setEditForm({ ...editForm, priority: Number(e.target.value) })}
          className="w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value={2}>High Priority</option>
          <option value={1}>Medium Priority</option>
          <option value={0}>Low Priority</option>
        </select>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="animate-pulse p-4 bg-white rounded-lg shadow">Loading wishlist...</div>;
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-4">
              No items in this wishlist yet.
            </p>
          ) : (
            items.map(item => (
              <motion.div
                key={item.id}
                onClick={() => editingItemId !== item.id && handleItemClick(item)}
                className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                whileHover={{ y: -2 }}
              >
                <div className="flex justify-between items-start">
                  {editingItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleSaveEdit(e, item.id)}
                        className="text-green-500 hover:text-green-700 p-1"
                        title="Save changes"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-500 hover:text-gray-700 p-1"
                        title="Cancel edit"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{item.title}</h3>
                      {isOwnWishlist && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleEditClick(e, item)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Edit item"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(item.id);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {editingItemId === item.id ? (
                  renderEditableContent(item)
                ) : (
                  <>
                    {item.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-2">{item.description}</p>
                    )}

                    {item.image_url && (
                      <img 
                        src={item.image_url} 
                        alt={item.title}
                        className="w-full h-32 object-cover rounded-md mb-2"
                      />
                    )}
                  </>
                )}

                <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
                  {!editingItemId && (
                    <>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        item.priority === 2 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                        item.priority === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {item.priority === 2 ? 'High' :
                         item.priority === 1 ? 'Medium' : 'Low'} Priority
                      </span>
                      {renderThinkingAbout(item)}
                    </>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{selectedItem.title}</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>

              {selectedItem.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">{selectedItem.description}</p>
              )}

              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  className="w-full max-h-96 object-contain rounded-lg mb-4"
                />
              )}

              {selectedItem.link && (
                <a
                  href={selectedItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-dark mb-4"
                >
                  <ExternalLink size={16} />
                  <span>View Item</span>
                </a>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

export default WishlistCard;