// WishlistCard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, Heart, Pencil, Check, X, ShoppingCart, ChevronDown, Flag, MessageCircle, Send } from 'lucide-react';
import { updateWishlistItem, addComment, deleteComment, getWishlistItems } from '../services/api';

// Constants
const MAX_TITLE_LENGTH = 200;
const MAX_TITLE_DISPLAY_LENGTH = 100; // Length at which to truncate title in modal view

function WishlistCard({ 
  member, 
  items, 
  isLoading, 
  isOwnWishlist, 
  currentUserId, 
  onUpdateItems, 
  onDeleteItem, 
  onThinkingAbout, 
  onMarkPurchased,
  onItemClick, // Add these new props
  onItemModalClose,
  selectedItem: externalSelectedItem // Coming from parent
}) {
  // Change this from useState to use the passed-in value if available
  const [internalSelectedItem, setInternalSelectedItem] = useState(null);
  // Use the external value if provided, otherwise use internal state
  const selectedItem = externalSelectedItem || internalSelectedItem;
  
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null); // 'interest-{itemId}' or 'purchase-{itemId}'
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [isDuplicateTitle, setIsDuplicateTitle] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const modalRef = useRef(null);

  // Check for duplicate titles when editing
  useEffect(() => {
    if (!editingItemId || !editForm.title || !items || items.length === 0) {
      setIsDuplicateTitle(false);
      return;
    }

    const normalizedTitle = editForm.title.trim().toLowerCase();
    const isDuplicate = items.some(item => 
      item.id !== editingItemId && 
      item.title.toLowerCase() === normalizedTitle
    );
    
    setIsDuplicateTitle(isDuplicate);
  }, [editForm.title, editingItemId, items]);

  const handleItemClick = (item) => {
    setInternalSelectedItem(item);
    if (onItemClick) onItemClick(item);
  };

  const handleCloseModal = () => {
    setInternalSelectedItem(null);
    if (onItemModalClose) onItemModalClose();
  };

  const handleEditClick = (e, item) => {
    e.stopPropagation();
    // Make sure item.title is truncated before setting in edit form
    setEditingItemId(item.id);
    setEditForm({
      ...item,
      title: truncateTitle(item.title),
      price: item.price !== null ? (item.price / 100).toFixed(2) : ''  // Convert cents to dollars for editing and format
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
      if (!editForm.title?.trim()) {
        throw new Error('Title is required');
      }

      // Check for duplicate title before saving
      if (isDuplicateTitle) {
        throw new Error('An item with this title already exists in the wishlist');
      }

      // Improved price handling for edit
      let processedPrice = null;
      if (editForm.price !== undefined && editForm.price !== null && editForm.price !== '') {
        const floatPrice = parseFloat(editForm.price);
        if (isNaN(floatPrice) || floatPrice < 0) {
          throw new Error('Price must be a valid positive number');
        }
        processedPrice = floatPrice;
      }

      const updatedData = {
        ...editForm,
        title: truncateTitle(editForm.title.trim()), // Ensure title is truncated
        description: editForm.description?.trim() || null,
        link: editForm.link?.trim() || null,
        image_url: editForm.image_url?.trim() || null,
        priority: Number(editForm.priority),
        price: processedPrice  // Backend will convert to cents
      };

      await updateWishlistItem(itemId, updatedData);
      await onUpdateItems();
      setEditingItemId(null);
      setEditForm({});
    } catch (error) {
      console.error('Failed to update item:', error);
      alert(error.userMessage || error.message || 'Failed to update item. Please try again.');
    }
  };

  const handleAddComment = async (itemId) => {
    if (!newComment.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }

    try {
      setCommentError('');
      await addComment(itemId, newComment.trim());
      await onUpdateItems(); // Refresh the list to show new comment
      setNewComment('');
      // Don't close the modal - improved!
      
      // Re-fetch the updated item to show the new comment immediately
      if (selectedItem && selectedItem.id === itemId) {
        const updatedItems = await getWishlistItems(member.id);
        const updatedItem = updatedItems.data.find(item => item.id === itemId);
        
        // Update the selected item with the latest data
        if (updatedItem) {
          // Update internal state
          setInternalSelectedItem(updatedItem);
          // Also update parent state if available
          if (onItemClick) onItemClick(updatedItem);
        }
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      setCommentError(
        err.response?.data?.detail || 
        err.userMessage || 
        'Failed to add comment. Please try again.'
      );
    }
  };
  
  // Prevent modal from closing when clicking inside
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId);
      await onUpdateItems();
      
      // Re-fetch the updated item to reflect the deleted comment immediately
      if (selectedItem) {
        const updatedItems = await getWishlistItems(member.id);
        const updatedItem = updatedItems.data.find(item => item.id === selectedItem.id);
        
        // Update the selected item with the latest data
        if (updatedItem) {
          // Update internal state
          setInternalSelectedItem(updatedItem);
          // Also update parent state if available
          if (onItemClick) onItemClick(updatedItem);
        }
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setCommentError('Failed to delete comment');
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
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onThinkingAbout(item.id);
        }}
        className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-all duration-300 min-w-[70px] min-h-[26px] justify-center ${
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
          <span className={`ml-1 px-1.5 py-0.5 ${
            isThinking ? 'bg-white/20' : 'bg-pink-100 dark:bg-pink-900/30'
          } rounded-full text-xs`}>
            {thinkingCount}
          </span>
        )}
      </button>
    );
  };

  const renderPurchaseButton = (item) => {
    if (isOwnWishlist) return null;
    
    const isPurchased = item.purchased_by && item.purchased_by === member.name;
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMarkPurchased(item.id);
        }}
        className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-all duration-300 min-w-[70px] min-h-[26px] justify-center ${
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
          <span className={`ml-1 px-1.5 py-0.5 ${
            isPurchased ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/30'
          } rounded-full text-xs`}>
            1
          </span>
        )}
      </button>
    );
  };

  const renderPriorityIcon = (priority) => {
    return (
      <div className="flex items-center">
        <Flag
          size={16}
          className={`fill-current ${
            priority === 2 ? 'text-red-500' :
            priority === 1 ? 'text-yellow-500' :
            'text-green-500'
          }`}
        />
        <span className={`ml-1 text-xs font-medium ${
          priority === 2 ? 'text-red-500' :
          priority === 1 ? 'text-yellow-500' :
          'text-green-500'
        }`}>
          {priority === 2 ? 'High' : priority === 1 ? 'Medium' : 'Low'}
        </span>
      </div>
    );
  };

  // Helper function to truncate title
  const truncateTitle = (title) => {
    return title && title.length > MAX_TITLE_LENGTH 
      ? title.substring(0, MAX_TITLE_LENGTH) 
      : title;
  };

  const renderEditableContent = (item) => (
    <div onClick={e => e.stopPropagation()} className="space-y-3">
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 dark:text-gray-400">
          Title* 
          <span className="text-xs text-gray-500 ml-1">
            ({editForm.title ? editForm.title.length : 0}/{MAX_TITLE_LENGTH})
          </span>
        </label>
        <input
          type="text"
          value={editForm.title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={e => setEditForm({ ...editForm, title: e.target.value.substring(0, MAX_TITLE_LENGTH) })}
          className={`w-full px-2 py-1 border rounded dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary ${
            isDuplicateTitle ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-500'
          }`}
          required
        />
        {isDuplicateTitle && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            An item with this title already exists
          </p>
        )}
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
          value={editForm.price !== null ? editForm.price : ''}
          onChange={e => setEditForm({ ...editForm, price: e.target.value ? e.target.value : null })}
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

  const renderActionButtons = (item) => {
    const hasComments = item.comments?.length > 0;
    
    return (
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {!isOwnWishlist && (
          <div className="flex items-center gap-1">
            {renderThinkingAbout(item)}
            {renderPurchaseButton(item)}
          </div>
        )}
        {hasComments && (
          <div className="flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
            <MessageCircle size={14} />
            <span className="text-xs ml-0.5">{item.comments.length}</span>
          </div>
        )}
      </div>
    );
  };

  const formatCommentTime = (timestamp) => {
    // Make sure we're working with a valid ISO string from the backend
    if (!timestamp) return '';
    
    try {
      const commentDate = new Date(timestamp + 'Z'); // Add 'Z' to handle UTC time properly
      const now = new Date();
      const diffMinutes = Math.floor((now - commentDate) / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      // Debug log to check timestamps
      console.log('Comment time:', {
        timestamp,
        commentDate,
        now,
        diffMinutes,
        diffHours,
        diffDays
      });

      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return commentDate.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: commentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return 'invalid date';
    }
  };

  if (isLoading) {
    return <div className="animate-pulse p-4 bg-white rounded-lg shadow">Loading wishlist...</div>;
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-[0_2px_15px_-3px_rgba(0,0,0,0.15),0_4px_6px_-4px_rgba(0,0,0,0.15)] p-6">
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
                className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.12),0_3px_6px_-3px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_25px_-6px_rgba(0,0,0,0.2),0_8px_16px_-8px_rgba(0,0,0,0.2)] transition-all duration-300 cursor-pointer ${
                  item.purchased_by && !isOwnWishlist ? 'opacity-60' : ''
                }`}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="flex justify-between items-start">
                  {editingItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleSaveEdit(e, item.id)}
                        className={`p-1 ${isDuplicateTitle ? 'text-gray-400 cursor-not-allowed' : 'text-green-500 hover:text-green-700'}`}
                        title="Save changes"
                        disabled={isDuplicateTitle}
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
                      <div className="flex flex-wrap items-start justify-between w-full gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 line-clamp-2 break-words overflow-hidden">{item.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.price !== null && (
                            <span className="inline-flex text-sm font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                              ${(item.price / 100).toFixed(2)}
                            </span>
                          )}
                          {isOwnWishlist && (
                            <div className="flex gap-1">
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
                      </div>
                    </>
                  )}
                </div>

                {editingItemId === item.id ? (
                  renderEditableContent(item)
                ) : (
                  <>
                    {item.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-3 break-words whitespace-pre-wrap">{item.description}</p>
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
                      {renderActionButtons(item)}
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10"
            onClick={handleCloseModal}
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={handleModalClick}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
            >
              <div className="pr-6 mb-4 w-full">
                {selectedItem.title.length > MAX_TITLE_DISPLAY_LENGTH && !showFullTitle ? (
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white break-words max-w-full pr-4">
                      {selectedItem.title.substring(0, MAX_TITLE_DISPLAY_LENGTH)}...
                    </h2>
                    <button 
                      onClick={() => setShowFullTitle(true)} 
                      className="text-sm text-primary hover:text-primary-dark dark:text-primary-400 mt-1"
                    >
                      Show full title
                    </button>
                  </div>
                ) : (
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white break-words max-w-full pr-4">
                    {selectedItem.title}
                    {showFullTitle && (
                      <button 
                        onClick={() => setShowFullTitle(false)} 
                        className="text-sm text-primary hover:text-primary-dark dark:text-primary-400 block mt-1"
                      >
                        Show less
                      </button>
                    )}
                  </h2>
                )}
              </div>

              {/* More spacing around description for readability */}
              {selectedItem.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-5 whitespace-pre-wrap break-words">
                  {selectedItem.description}
                </p>
              )}

              {/* Set max-height for image and optimize for mobile */}
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  className="w-full h-auto max-h-72 object-contain rounded-lg mb-4"
                />
              )}

              {/* After the existing price section */}
              <div className="flex flex-col space-y-4 mt-4">
                {selectedItem.price !== null && (
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Price: ${(selectedItem.price / 100).toFixed(2)}
                  </p>
                )}

                {/* Only show Interest/Purchase sections when not viewing own wishlist */}
                {!isOwnWishlist && (
                  <>
                    {/* Interested People Section */}
                    {selectedItem.thinking_about_by_list?.length > 0 && (
                      <div className="border-t dark:border-gray-700 pt-4">
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Interested:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedItem.thinking_about_by_list.map((name) => (
                            <span key={name} className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Purchase Status Section */}
                    {selectedItem.purchased_by && (
                      <div className="border-t dark:border-gray-700 pt-4">
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Purchase Status:
                        </h3>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                          Purchased by {selectedItem.purchased_by}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Comments Section - Always show for admin users */}
                <div className="border-t dark:border-gray-700 pt-4">
                  <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <MessageCircle size={18} />
                    Comments ({selectedItem.comments?.length || 0})
                  </h3>
                  
                  {/* Comments List with scroll - reduced max height for mobile and ordering changed */}
                  <div className="space-y-2 mb-3 max-h-[25vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {selectedItem.comments
                      ?.slice() // Create a copy so we don't mutate the original array
                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // Oldest first
                      .map((comment) => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {comment.author_name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400">
                                {formatCommentTime(comment.created_at)}
                              </span>
                              {/* FIX: Update this condition so admins can delete any comment */}
                              {(selectedUser?.name?.toLowerCase() === 'admin' || member.name.toLowerCase() === 'admin' || currentUserId === comment.author_id) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteComment(comment.id);
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                  title="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 text-sm mt-0.5">
                            {comment.text}
                          </p>
                        </div>
                      ))}

                    {selectedItem.comments?.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                        No comments yet
                      </p>
                    )}
                  </div>

                  {/* Add Comment Form - Only show for non-owners or admin */}
                  {(!isOwnWishlist || member.name.toLowerCase() === 'admin') && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 px-1">
                          <span>Add a comment</span>
                          <span>{newComment.length}/200</span>
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value.slice(0, 200))}
                            placeholder="Type your comment..."
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(selectedItem.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddComment(selectedItem.id)}
                            className="p-1.5 text-white bg-primary hover:bg-primary-dark rounded-md"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                        {commentError && (
                          <p className="text-red-500 text-xs mt-1">{commentError}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sticky footer with View Item and Close buttons */}
              <div className="sticky bottom-0 left-0 right-0 mt-6 pt-3 pb-2 bg-gradient-to-t from-white dark:from-gray-800 to-transparent">
                <div className="flex gap-3">
                  {selectedItem.link && (
                    <a
                      href={selectedItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
                    >
                      <ExternalLink size={18} />
                      <span className="font-medium">View Item</span>
                    </a>
                  )}
                  <button
                    onClick={handleCloseModal}
                    className={`${selectedItem.link ? 'w-28' : 'flex-1'} py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200`}
                    aria-label="Close modal"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

export default WishlistCard;