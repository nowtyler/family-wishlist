// WishlistCard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, Heart, Pencil, Check, X, ShoppingCart, ChevronDown, Star } from 'lucide-react';
import { updateWishlistItem } from '../services/api';

function WishlistCard({ member, items, isLoading, isOwnWishlist, currentUserId, onUpdateItems, onDeleteItem, onThinkingAbout, onMarkPurchased }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null); // 'interest-{itemId}' or 'purchase-{itemId}'

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
      ...item,
      price: item.price ? (item.price / 100) : ''  // Convert cents to dollars for editing
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
        priority: Number(editForm.priority),
        price: editForm.price ? parseFloat(editForm.price) : null
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

  const FloatingTooltip = ({ children, onClose }) => (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="absolute z-10 bg-white dark:bg-gray-700 shadow-lg rounded-lg p-3 text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600"
      >
        <X size={12} />
      </button>
    </motion.div>
  );

  const renderThinkingAbout = (item) => {
    if (isOwnWishlist) return null;
    
    const isThinking = item.thinking_about_by_list?.includes(currentUserId);
    const thinkingCount = item.thinking_about_by_list?.length || 0;
    const tooltipId = `interest-${item.id}`;
    
    return (
      <div className="flex items-center relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onThinkingAbout(item.id);
          }}
          className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-all duration-300 ${
            isThinking
              ? 'bg-pink-500 text-white hover:bg-pink-600'
              : 'text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20'
          }`}
        >
          <Heart
            size={16}
            className={`${isThinking ? 'fill-current' : ''} transition-all duration-300`}
          />
          {thinkingCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId);
              }}
              className={`ml-1 px-1.5 py-0.5 ${
                isThinking ? 'bg-white/20' : 'bg-pink-100 dark:bg-pink-900/30'
              } rounded-full text-xs flex items-center gap-1 hover:bg-opacity-75`}
            >
              {thinkingCount}
              <ChevronDown size={12} className={activeTooltip === tooltipId ? 'rotate-180' : ''} />
            </button>
          )}
        </button>

        <AnimatePresence>
          {activeTooltip === tooltipId && thinkingCount > 0 && (
            <FloatingTooltip onClose={() => setActiveTooltip(null)}>
              <div className="min-w-[150px]">
                <p className="font-semibold mb-1">Interested:</p>
                <ul className="space-y-1">
                  {item.thinking_about_by_list.map((name) => (
                    <li key={name} className="text-gray-600 dark:text-gray-300">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </FloatingTooltip>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderPurchaseButton = (item) => {
    if (isOwnWishlist) return null;
    
    const isPurchased = item.purchased_by && item.purchased_by === member.name;
    const tooltipId = `purchase-${item.id}`;
    
    return (
      <div className="flex items-center relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkPurchased(item.id);
          }}
          className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-all duration-300 ${
            isPurchased
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
          }`}
        >
          <ShoppingCart
            size={16}
            className={`${isPurchased ? 'fill-current' : ''} transition-all duration-300`}
          />
          {item.purchased_by && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId);
              }}
              className={`ml-1 px-1.5 py-0.5 ${
                isPurchased ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/30'
              } rounded-full text-xs flex items-center gap-1 hover:bg-opacity-75`}
            >
              1
              <ChevronDown size={12} className={activeTooltip === tooltipId ? 'rotate-180' : ''} />
            </button>
          )}
        </button>
        
        {item.purchased_by && (
          <AnimatePresence>
            {activeTooltip === tooltipId && (
              <FloatingTooltip onClose={() => setActiveTooltip(null)}>
                <div className="min-w-[150px]">
                  <p className="font-semibold mb-1">Purchase Status:</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    Purchased by {item.purchased_by}
                  </p>
                </div>
              </FloatingTooltip>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  const renderPriorityIcon = (priority) => {
    return (
      <div className="flex items-center">
        {[...Array(priority + 1)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={`fill-current ${
              priority === 2 ? 'text-red-500' :
              priority === 1 ? 'text-yellow-500' :
              'text-green-500'
            }`}
          />
        ))}
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
        <label className="text-sm text-gray-600 dark:text-gray-400">Price</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={editForm.price}
          onChange={e => setEditForm({ ...editForm, price: e.target.value })}
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
                className={`bg-white dark:bg-gray-700 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow cursor-pointer ${
                  item.purchased_by && !isOwnWishlist ? 'opacity-60' : ''
                }`}
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
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.price !== null && (
                          <span className="inline-flex text-sm font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 shrink-0">
                            ${(item.price / 100).toFixed(2)}
                          </span>
                        )}
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
                      </div>
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

                <div className="flex items-center flex-wrap justify-between gap-1 mt-2">
                  {!editingItemId && (
                    <>
                      <div className="flex items-center gap-2">
                        {renderPriorityIcon(item.priority)}
                      </div>
                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        {item.price !== null && (
                          <span className="inline-flex text-sm font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 shrink-0">
                            ${(item.price / 100).toFixed(2)}
                          </span>
                        )}
                        {renderThinkingAbout(item)}
                        {renderPurchaseButton(item)}
                      </div>
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

              <div className="flex flex-col space-y-4">
                {selectedItem.price !== null && (
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Price: ${(selectedItem.price / 100).toFixed(2)}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

export default WishlistCard;