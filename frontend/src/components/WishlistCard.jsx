// WishlistCard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, MessageCircleHeart, Check, X, MessageCircle, Send, Download, Upload, Link2, ShoppingCart, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { toast } from 'react-toastify';
import { updateWishlistItem, updateSharedWishlistItem, addComment, deleteComment, getWishlistItems, exportWishlist, importWishlist, addShoppingCartItemFromWishlistItem, getShoppingCartItems, deleteShoppingCartItem, markPurchased, addShoppingCartItemFromSharedWishlistItem, addSharedWishlistItemComment, getSharedWishlist, toggleSharedItemPurchased } from '../services/api';

// Constants
const MAX_TITLE_LENGTH = 200;
const MAX_TITLE_DISPLAY_LENGTH = 100; // Length at which to truncate title in modal view
const MAX_DESCRIPTION_DISPLAY_LENGTH = 300; // Length at which to truncate description in modal view

// Add size options for item-specific sizing to the top of the file
const sizeOptions = {
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  hoodie: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  pants: {
    men: [
      "28x30", "28x32", "30x30", "30x32", "30x34", 
      "31x30", "31x32", "31x34", 
      "32x30", "32x32", "32x34", "32x36", 
      "33x30", "33x32", "33x34", "33x36",
      "34x30", "34x32", "34x34", "34x36",
      "36x30", "36x32", "36x34", "36x36",
      "38x30", "38x32", "38x34", "38x36",
      "40x30", "40x32", "40x34",
      "42x30", "42x32", "42x34",
      "44x30", "44x32",
      "46x30", "46x32"
    ],
    women: ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"]
  },
  dress: [
    "XS", "S", "M", "L", "XL", "XXL",
    "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"
  ],
  shoes: {
    men: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15"],
    women: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"]
  }
};

/**
 * @typedef {{ id: number|string, author_id?: number|string, author_name?: string, text?: string, created_at?: string }} WishlistComment
 * @typedef {{
 *   id: number|string,
 *   title: string,
 *   description?: string,
 *   link?: string,
 *   image_url?: string,
 *   price?: number|string|null,
 *   priority?: number,
 *   comments?: WishlistComment[],
 *   purchased_by?: number|string|null,
 *   thinking_about?: boolean,
 *   size_type?: string,
 *   size_value?: string,
 *   size_gender?: string,
 *   created_at?: string
 * }} WishlistItem
 * @typedef {{
 *   member: { id: number|string, name: string, external_wishlist_count?: number },
 *   items: WishlistItem[],
 *   isLoading?: boolean,
 *   isOwnWishlist?: boolean,
 *   currentUserId?: number|string,
 *   onUpdateItems?: () => void | Promise<void>,
 *   onDeleteItem?: (itemId: number|string) => void,
 *   onThinkingAbout?: (itemId: number|string) => void,
 *   onItemClick?: (item: WishlistItem) => void,
 *   onItemModalClose?: () => void,
 *   selectedItem?: WishlistItem|null,
 *   onCartUpdated?: (nextCount?: number) => void,
 *   currentUserName?: string,
 *   onOptimisticUpdateItem?: (itemId: number|string, updates: Partial<WishlistItem>) => void,
 *   onEditModalStateChange?: (isOpen: boolean) => void
 * }} WishlistCardProps
 */

/** @type {import('react').FC<WishlistCardProps>} */
const WishlistCard = (props) => {
  const {
    member,
    items,
    isLoading,
    isOwnWishlist,
    noSecretsMode,
    currentUserId,
    onUpdateItems,
    onDeleteItem,
    onThinkingAbout,
    onItemClick,
    onItemModalClose,
    selectedItem: externalSelectedItem,
    onCartUpdated,
    currentUserName,
    onOptimisticUpdateItem,
    onEditModalStateChange
  } = props;
  // In no_secrets mode, owners can see and interact with purchase/thinking actions
  const showPurchaseActions = !isOwnWishlist || noSecretsMode;
  /** @type {WishlistItem[]} */
  const safeItems = Array.isArray(items) ? items : [];
  // Change this from useState to use the passed-in value if available
  const [internalSelectedItem, setInternalSelectedItem] = useState(null);
  // Use the external value if provided, otherwise use internal state
  const selectedItem = externalSelectedItem || internalSelectedItem;
  
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(/** @type {WishlistItem} */ ({}));
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [isDuplicateTitle, setIsDuplicateTitle] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [sizeType, setSizeType] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeGender, setSizeGender] = useState('unspecified');
  const [showSizeFields, setShowSizeFields] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState(null); // Track item pending deletion
  const modalRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [addingToCartItemId, setAddingToCartItemId] = useState(null);
  const [removingFromCartItemId, setRemovingFromCartItemId] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Check for duplicate titles when editing
  useEffect(() => {
    if (!editingItemId || !editForm.title || !safeItems.length) {
      setIsDuplicateTitle(false);
      return;
    }

    const normalizedTitle = editForm.title.trim().toLowerCase();
    const isDuplicate = safeItems.some(item => 
      item.id !== editingItemId && 
      item.title.toLowerCase() === normalizedTitle
    );
    
    setIsDuplicateTitle(isDuplicate);
  }, [editForm.title, editingItemId, safeItems]);

  useEffect(() => {
    onEditModalStateChange?.(Boolean(editingItemId));
  }, [editingItemId, onEditModalStateChange]);

  useEffect(() => {
    if (!editingItemId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingItemId]);

  const openEditModal = (item) => {
    setEditingItemId(item.id);
    setEditForm({
      ...item,
      title: truncateTitle(item.title),
      price: item.price !== null ? (item.price / 100).toFixed(2) : ''
    });
    setSizeType('');
    setSizeValue('');
    setSizeGender('unspecified');
    setShowSizeFields(false);
    setShowAdvancedFields(false);
  };

  const handleItemClick = (item) => {
    if (isOwnWishlist) {
      openEditModal(item);
      return;
    }
    setInternalSelectedItem(item);
    if (onItemClick) onItemClick(item);
  };

  const handleCloseModal = () => {
    setInternalSelectedItem(null);
    setShowFullDescription(false);
    if (onItemModalClose) onItemModalClose();
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditForm(/** @type {WishlistItem} */ ({}));
    setIsSavingEdit(false);
    setShowAdvancedFields(false);
  };

  const handleSaveEdit = async (itemId) => {
    try {
      setIsSavingEdit(true);
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
        const floatPrice = parseFloat(String(editForm.price));
        if (isNaN(floatPrice) || floatPrice < 0) {
          throw new Error('Price must be a valid positive number');
        }
        processedPrice = floatPrice;
      }

      // Handle size information in description
      let updatedDescription = editForm.description?.trim() || '';
      
      // Add size information if provided
      if (sizeType && sizeValue) {
        // Check if description already has size info
        const hasSizeInfo = updatedDescription.includes('\n\nSize:');
        
        if (hasSizeInfo) {
          // Replace existing size info
          updatedDescription = updatedDescription.replace(
            /\n\nSize:.*$/,
            `\n\nSize: ${sizeType.charAt(0).toUpperCase() + sizeType.slice(1)} - ${sizeValue}`
          );
        } else {
          // Add new size info
          updatedDescription = updatedDescription + (updatedDescription ? `\n\nSize: ${sizeType.charAt(0).toUpperCase() + sizeType.slice(1)} - ${sizeValue}` : `Size: ${sizeType.charAt(0).toUpperCase() + sizeType.slice(1)} - ${sizeValue}`);
        }
      }

      const updatedData = {
        ...editForm,
        title: truncateTitle(editForm.title.trim()), // Ensure title is truncated
        description: updatedDescription || null,
        link: editForm.link?.trim() || null,
        image_url: editForm.image_url?.trim() || null,
        priority: Number(editForm.priority),
        price: processedPrice  // Backend will convert to cents
      };
      const optimisticUpdates = {
        title: updatedData.title,
        description: updatedData.description,
        link: updatedData.link,
        image_url: updatedData.image_url,
        priority: updatedData.priority,
        price: processedPrice !== null ? Math.round(processedPrice * 100) : null
      };

      // Update UI immediately so edits are visible as soon as Save is clicked.
      if (onOptimisticUpdateItem) {
        onOptimisticUpdateItem(itemId, optimisticUpdates);
      }

      if (member.is_shared_wishlist) {
        await updateSharedWishlistItem(itemId, updatedData);
        await onUpdateItems(true); // skip reload
      } else {
        await updateWishlistItem(itemId, updatedData);
        await onUpdateItems(true); // skip immediate reload to preserve optimistic UI
      }
      setEditingItemId(null);
      setEditForm(/** @type {WishlistItem} */ ({}));
      // Reset size fields
      setSizeType('');
      setSizeValue('');
      setSizeGender('unspecified');
    } catch (error) {
      console.error('Failed to update item:', error);
      // Re-sync from server if optimistic update was applied but save failed.
      await onUpdateItems?.();
      alert(error.userMessage || error.message || 'Failed to update item. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddComment = async (itemId) => {
    if (!newComment.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }

    try {
      setCommentError('');
      const commentText = newComment.trim();

      // Use appropriate API based on wishlist type
      let createdComment = null;
      if (member.is_shared_wishlist) {
        const response = await addSharedWishlistItemComment(itemId, commentText);
        createdComment = response?.data || null;
      } else {
        const response = await addComment(itemId, commentText);
        createdComment = response?.data || null;
      }

      setNewComment('');

      if (createdComment) {
        // Update item comments immediately to prevent modal flash/reload
        const matchedItem = (selectedItem && selectedItem.id === itemId)
          ? selectedItem
          : safeItems.find(item => item.id === itemId);
        const baseComments = Array.isArray(matchedItem?.comments) ? matchedItem.comments : [];
        const nextComments = [...baseComments, createdComment];
        const updatedItem = selectedItem && selectedItem.id === itemId
          ? { ...selectedItem, comments: nextComments }
          : null;

        if (updatedItem) {
          setInternalSelectedItem(updatedItem);
          if (onItemClick) onItemClick(updatedItem);
        }

        if (onOptimisticUpdateItem) {
          onOptimisticUpdateItem(itemId, {
            comments: updatedItem?.comments || nextComments
          });
        }
      }

      if (member.is_shared_wishlist) {
        await onUpdateItems(true);
      } else {
        await onUpdateItems();
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
        let updatedItem = null;

        if (member.is_shared_wishlist) {
          // For shared wishlists, get items from the shared wishlist
          const response = await getSharedWishlist(member.shared_wishlist_id);
          const items = response.data?.items || [];
          updatedItem = items.find(item => item.id === selectedItem.id);
        } else {
          // For regular wishlists
          const updatedItems = await getWishlistItems(Number(member.id));
          updatedItem = updatedItems.data.find(item => item.id === selectedItem.id);
        }

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
    if (!showPurchaseActions) return null;
    
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
        <MessageCircleHeart
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

  const handleAddToCart = async (item) => {
    const previousPurchasedBy = item.purchased_by;
    try {
      setAddingToCartItemId(item.id);

      // Check if this is a shared wishlist
      if (member.is_shared_wishlist) {
        if (onOptimisticUpdateItem) {
          onOptimisticUpdateItem(item.id, {
            purchased_by: currentUserName || 'You'
          });
        }
        await addShoppingCartItemFromSharedWishlistItem(item.id, member.shared_wishlist_id);
      } else {
        await addShoppingCartItemFromWishlistItem(item.id, member.id);
      }

      toast.success('Added to cart.');
      await onUpdateItems?.(true);
      onCartUpdated?.();
    } catch (error) {
      console.error('Failed to add item to cart:', error);
      if (member.is_shared_wishlist && onOptimisticUpdateItem) {
        onOptimisticUpdateItem(item.id, {
          purchased_by: previousPurchasedBy || null
        });
      }
      if (error.response?.status === 409) {
        toast.info(error.response?.data?.detail || 'Item already reserved.');
      } else if (error.response?.status === 403) {
        toast.error(error.response?.data?.detail || 'You cannot reserve items from your own wishlist.');
      } else {
        toast.error('Failed to add item to cart.');
      }
    } finally {
      setAddingToCartItemId(null);
    }
  };

  const handleRemoveFromCart = async (item) => {
    const previousPurchasedBy = item.purchased_by;
    try {
      if (!currentUserId) return;
      setRemovingFromCartItemId(item.id);
      const response = await getShoppingCartItems(currentUserId);
      const cartItems = Array.isArray(response?.data) ? response.data : [];

      // Find cart item by appropriate ID based on wishlist type
      const cartItem = member.is_shared_wishlist
        ? cartItems.find((cart) => cart.shared_wishlist_item_id === item.id)
        : cartItems.find((cart) => cart.wishlist_item_id === item.id);

      if (!cartItem) {
        if (currentUserName && item.purchased_by === currentUserName) {
          try {
            // Use appropriate toggle based on wishlist type
            if (member.is_shared_wishlist) {
              if (onOptimisticUpdateItem) {
                onOptimisticUpdateItem(item.id, { purchased_by: null });
              }
              await toggleSharedItemPurchased(item.id);
            } else {
              await markPurchased(item.id);
            }
            toast.success('Reservation cleared.');
          } catch (fallbackError) {
            console.error('Failed to clear reservation:', fallbackError);
            toast.info('Item is no longer in your cart.');
          }
        } else {
          toast.info('Item is no longer in your cart.');
        }
        await onUpdateItems?.(true);
        onCartUpdated?.();
        return;
      }
      if (member.is_shared_wishlist && onOptimisticUpdateItem) {
        onOptimisticUpdateItem(item.id, { purchased_by: null });
      }
      await deleteShoppingCartItem(cartItem.id);
      toast.success('Removed from cart.');
      await onUpdateItems?.(true);
      onCartUpdated?.();
    } catch (error) {
      console.error('Failed to remove item from cart:', error);
      if (member.is_shared_wishlist && onOptimisticUpdateItem) {
        onOptimisticUpdateItem(item.id, {
          purchased_by: previousPurchasedBy || null
        });
      }
      toast.error('Failed to remove item from cart.');
    } finally {
      setRemovingFromCartItemId(null);
    }
  };

  // Helper function to truncate title
  const truncateTitle = (title) => {
    return title && title.length > MAX_TITLE_LENGTH 
      ? title.substring(0, MAX_TITLE_LENGTH) 
      : title;
  };

  // Function to get appropriate size options based on type and gender
  const getSizeOptions = (type, gender) => {
    if (!type) return [];
    if (type === 'pants' || type === 'shoes') {
      return gender === 'women' ? sizeOptions[type].women : sizeOptions[type].men;
    }
    return sizeOptions[type] || [];
  };

  const renderActionButtons = (item) => {
    const hasComments = item.comments?.length > 0;
    const isReservedByOther =
      showPurchaseActions &&
      item.purchased_by &&
      currentUserName &&
      item.purchased_by !== currentUserName;
    const isReservedBySelf =
      showPurchaseActions &&
      item.purchased_by &&
      currentUserName &&
      item.purchased_by === currentUserName;

    return (
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {showPurchaseActions && (
          <div className="flex items-center gap-1">
            {renderThinkingAbout(item)}
            {isReservedBySelf ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromCart(item);
                }}
                className="flex items-center justify-center text-sm px-2 py-0.5 rounded-full transition-all duration-300 min-w-[36px] min-h-[26px] text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                disabled={removingFromCartItemId === item.id}
                aria-label={removingFromCartItemId === item.id ? 'Removing from cart' : 'Remove from cart'}
                title={removingFromCartItemId === item.id ? 'Removing...' : 'Remove from cart'}
              >
                <ShoppingCart
                  size={16}
                  className={removingFromCartItemId === item.id ? 'animate-pulse' : ''}
                />
                <span className="sr-only">
                  {removingFromCartItemId === item.id ? 'Removing...' : 'Remove from cart'}
                </span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                className={`flex items-center justify-center text-sm px-2 py-0.5 rounded-full transition-all duration-300 min-w-[36px] min-h-[26px] ${
                  isReservedByOther
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/20'
                }`}
                disabled={addingToCartItemId === item.id || isReservedByOther}
                aria-label={
                  isReservedByOther
                    ? `Reserved by ${item.purchased_by}`
                    : addingToCartItemId === item.id
                      ? 'Adding to cart'
                      : 'Add to cart'
                }
                title={
                  isReservedByOther
                    ? `Reserved by ${item.purchased_by}`
                    : addingToCartItemId === item.id
                      ? 'Adding...'
                      : 'Add to cart'
                }
              >
                <ShoppingCart
                  size={16}
                  className={addingToCartItemId === item.id ? 'animate-pulse' : ''}
                />
                <span className="sr-only">
                  {isReservedByOther
                    ? `Reserved by ${item.purchased_by}`
                    : addingToCartItemId === item.id
                      ? 'Adding...'
                      : 'Add to cart'}
                </span>
              </button>
            )}
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
    if (!timestamp) return '';
    
    try {
      // Do not force UTC; parse whatever the backend provided.
      const commentDate = new Date(String(timestamp));
      if (Number.isNaN(commentDate.getTime())) return '';

      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - commentDate.getTime()) / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

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
      return 'invalid date';
    }
  };

  const handleExport = async () => {
    try {
      const response = await exportWishlist(member.id);
      
      // Create a Blob from the response data
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `wishlist-${new Date().toISOString().split('T')[0]}-${member.name.toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export wishlist:', error);
      alert('Failed to export wishlist. Please try again.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const { result } = e.target || {};
          if (typeof result !== 'string') {
            throw new Error('Invalid wishlist file');
          }
          const wishlistData = JSON.parse(result);
          const response = await importWishlist(member.id, wishlistData);
          await onUpdateItems();
          
          // Show feedback about imported and skipped items
          const { imported_items, skipped_items } = response.data;
          if (imported_items.length === 0 && skipped_items.length > 0) {
            alert('All items were already in your wishlist. No new items were imported.');
          } else if (skipped_items.length > 0) {
            alert(`Successfully imported ${imported_items.length} items.\n\nSkipped ${skipped_items.length} duplicate items:\n${skipped_items.join('\n')}`);
          } else {
            alert(`Successfully imported ${imported_items.length} items!`);
          }
        } catch (error) {
          console.error('Failed to import wishlist:', error);
          alert('Failed to import wishlist. Please check the file format and try again.');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert('Failed to read file. Please try again.');
    } finally {
      setIsImporting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                No items in this wishlist yet.
              </p>

              {/* Show external wishlist prompt if they exist */}
              {!isOwnWishlist && member.external_wishlist_count > 0 && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <Link2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    {member.name} has {member.external_wishlist_count} external wishlist{member.external_wishlist_count === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            items.map(item => (
              <motion.div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg p-4 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.12),0_3px_6px_-3px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_25px_-6px_rgba(0,0,0,0.2),0_8px_16px_-8px_rgba(0,0,0,0.2)] transition-all duration-300 cursor-pointer ${
                  item.purchased_by && !isOwnWishlist ? 'opacity-60' : ''
                }`}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                {item.priority >= 1 && (
                  <div
                    className="absolute bottom-0 left-5 h-[17px] w-10 rounded-t-md bg-rose-400 dark:bg-rose-500 pointer-events-none overflow-visible"
                    role="img"
                    aria-label="Most Wanted"
                    title="Most Wanted"
                  >
                    <Star
                      size={26}
                      strokeWidth={1.5}
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 fill-rose-600/55 text-rose-600/55 dark:fill-rose-700/60 dark:text-rose-700/60 drop-shadow-[0_-1px_1px_rgba(0,0,0,0.22)] drop-shadow-[0_1px_0_rgba(255,255,255,0.08)]"
                    />
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-wrap items-start justify-between w-full gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 line-clamp-2 break-words overflow-hidden">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.price !== null && item.price !== undefined && !Number.isNaN(Number(item.price)) && (
                        <span className="inline-flex text-sm font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          ${(Number(item.price) / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

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

                <div className="flex items-center flex-wrap justify-end gap-1 mt-2">
                  <>
                    <div className="flex items-center justify-end gap-2 min-w-0">
                      {showPurchaseActions && item.purchased_by && (
                        <span
                          className={`inline-flex items-center text-[11px] leading-none font-semibold px-2 py-1 rounded-full max-w-[140px] sm:max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis ${
                            currentUserName && item.purchased_by === currentUserName
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                          title={
                            currentUserName && item.purchased_by === currentUserName
                              ? 'Reserved by you'
                              : `Reserved by ${item.purchased_by}`
                          }
                        >
                          {currentUserName && item.purchased_by === currentUserName
                            ? 'In your cart'
                            : `Reserved: ${item.purchased_by}`}
                        </span>
                      )}
                      {renderActionButtons(item)}
                    </div>
                  </>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Full-Card Edit Modal */}
      {editingItemId && (
        <AnimatePresence>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={handleCancelEdit}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl mx-auto my-8 max-h-[90vh] overflow-hidden z-[110] bg-white dark:bg-gray-800 rounded-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-y-auto p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Edit Wishlist Item
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {member?.is_shared_wishlist ? 'Shared wishlist item' : 'Personal wishlist item'}
                    </p>
                  </div>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Close edit modal"
                    disabled={isSavingEdit}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 pb-4">
                  {editForm.image_url && (
                    <img
                      src={editForm.image_url}
                      alt={editForm.title || 'Wishlist item'}
                      className="w-full max-h-64 object-contain rounded-lg bg-gray-50 dark:bg-gray-900/40"
                    />
                  )}

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editForm.title ?? ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value.substring(0, MAX_TITLE_LENGTH)
                        }))
                      }
                      className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                        isDuplicateTitle
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      maxLength={MAX_TITLE_LENGTH}
                    />
                    {isDuplicateTitle && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                        An item with this title already exists.
                      </p>
                    )}
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      value={editForm.price ?? ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={(editForm.priority ?? 0) >= 1}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, priority: e.target.checked ? 1 : 0 }))
                        }
                      />
                      <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-rose-500 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Most Wanted
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFields((prev) => !prev)}
                  className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {showAdvancedFields ? (
                    <>
                      <ChevronUp size={16} className="mr-1" />
                      Hide additional details
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} className="mr-1" />
                      Show additional details
                    </>
                  )}
                </button>

                {showAdvancedFields && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editForm.description ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Product URL
                      </label>
                      <input
                        type="url"
                        value={editForm.link ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, link: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="https://example.com/item"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Image URL
                      </label>
                      <input
                        type="url"
                        value={editForm.image_url ?? ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, image_url: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="https://example.com/image.jpg"
                      />
                      {editForm.image_url && (
                        <img
                          src={editForm.image_url}
                          alt="Wishlist item preview"
                          className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                        />
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Size Information</span>
                        <button
                          type="button"
                          onClick={() => setShowSizeFields(!showSizeFields)}
                          className="ml-auto text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {showSizeFields ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      {showSizeFields && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                              Size Type
                            </label>
                            <select
                              value={sizeType}
                              onChange={(e) => {
                                setSizeType(e.target.value);
                                setSizeValue('');
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Not specified</option>
                              <option value="tshirt">T-Shirt</option>
                              <option value="hoodie">Hoodie/Sweatshirt</option>
                              <option value="dress">Dress</option>
                              <option value="pants">Pants</option>
                              <option value="shoes">Shoes</option>
                            </select>
                          </div>

                          {(sizeType === 'pants' || sizeType === 'shoes') && (
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Gender
                              </label>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="sizeGender"
                                    value="men"
                                    checked={sizeGender === 'men'}
                                    onChange={() => {
                                      setSizeGender('men');
                                      setSizeValue('');
                                    }}
                                    className="mr-1"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Men's</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name="sizeGender"
                                    value="women"
                                    checked={sizeGender === 'women'}
                                    onChange={() => {
                                      setSizeGender('women');
                                      setSizeValue('');
                                    }}
                                    className="mr-1"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Women's</span>
                                </label>
                              </div>
                            </div>
                          )}

                          {sizeType && (
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Size
                              </label>
                              <select
                                value={sizeValue}
                                onChange={(e) => setSizeValue(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">Select size</option>
                                {getSizeOptions(sizeType, sizeGender).map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                </div>
              </div>

              <div className="shrink-0 px-5 py-3 border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex justify-between gap-2">
                <button
                  onClick={() => {
                    const itemId = editingItemId;
                    handleCancelEdit();
                    setPendingDeleteItemId(itemId);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                  disabled={isSavingEdit}
                  title="Delete item"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(editingItemId)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    disabled={isSavingEdit || isDuplicateTitle}
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleCloseModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
            }}
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={handleModalClick}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] relative flex flex-col"
            >
              <div className="overflow-y-auto flex-1 p-4 sm:p-6 pb-0">
              {selectedItem.priority >= 1 && !isOwnWishlist && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                    ★ Most Wanted
                  </span>
                </div>
              )}
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
                <div className="mb-5">
                  {selectedItem.description.length > MAX_DESCRIPTION_DISPLAY_LENGTH && !showFullDescription ? (
                    <>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {selectedItem.description.substring(0, MAX_DESCRIPTION_DISPLAY_LENGTH)}...
                      </p>
                      <button 
                        onClick={() => setShowFullDescription(true)} 
                        className="text-sm text-primary hover:text-primary-dark dark:text-primary-400 mt-1"
                      >
                        Show full description
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {selectedItem.description}
                      </p>
                      {showFullDescription && selectedItem.description.length > MAX_DESCRIPTION_DISPLAY_LENGTH && (
                        <button 
                          onClick={() => setShowFullDescription(false)} 
                          className="text-sm text-primary hover:text-primary-dark dark:text-primary-400 mt-1"
                        >
                          Show less
                        </button>
                      )}
                    </>
                  )}
                </div>
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

                {/* Show Interest/Purchase sections when not viewing own wishlist, or in no_secrets mode */}
                {showPurchaseActions && (
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
                          Reservation Status:
                        </h3>
                        {currentUserName && selectedItem.purchased_by === currentUserName ? (
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 rounded-full text-sm">
                            Reserved by you
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full text-sm">
                            Reserved by {selectedItem.purchased_by}
                          </span>
                        )}
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
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Oldest first
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
                              {(member?.name?.toLowerCase() === 'admin' || member.name.toLowerCase() === 'admin' || currentUserId === comment.author_id) && (
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
              </div>

              {/* Fixed footer with View Item and Close buttons */}
              <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
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

      {/* Delete Confirmation Dialog */}
      {pendingDeleteItemId && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setPendingDeleteItemId(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Confirm Deletion</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete this item? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPendingDeleteItemId(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const itemId = pendingDeleteItemId;
                    setPendingDeleteItemId(null);
                    onDeleteItem(itemId);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
};

export default WishlistCard;
