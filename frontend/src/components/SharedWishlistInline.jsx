// SharedWishlistInline.jsx - Inline component for viewing shared wishlist items in main dashboard
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getSharedWishlist,
  deleteSharedWishlistItem,
  toggleSharedItemThinking
} from '../services/api';
import WishlistCard from './WishlistCard';

const SharedWishlistInline = ({
  wishlist,
  currentUserId,
  currentUserName,
  isOwner,
  onUpdateItems,
  onCartUpdated,
  reloadTrigger = 0,
  clearTrigger = 0,
  optimisticUpdate = null,
  openItemId = null,
  onClearOpenItemId = null
}) => {
  const [wishlistData, setWishlistData] = useState(wishlist);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadWishlist = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const response = await getSharedWishlist(wishlist.id);
      setWishlistData(response.data);
      setItems(response.data.items || []);
      if (onUpdateItems) {
        onUpdateItems();
      }
    } catch (error) {
      console.error('Failed to load shared wishlist:', error);
      toast.error('Failed to load wishlist items');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [wishlist.id, onUpdateItems]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  // Reload when wishlist prop changes (e.g., URL navigation)
  useEffect(() => {
    if (wishlist.id !== wishlistData?.id) {
      setWishlistData(wishlist);
      loadWishlist();
    }
  }, [wishlist.id, wishlistData?.id, loadWishlist]);

  // Reload when reloadTrigger changes (e.g., item added)
  useEffect(() => {
    if (reloadTrigger > 0) {
      loadWishlist({ showLoading: false });
    }
  }, [reloadTrigger, loadWishlist]);

  useEffect(() => {
    if (clearTrigger > 0) {
      setItems([]);
      setIsLoading(false);
      if (onUpdateItems) {
        onUpdateItems();
      }
      loadWishlist({ showLoading: false });
    }
  }, [clearTrigger, loadWishlist, onUpdateItems]);

  const handleDeleteItem = async (itemId) => {
    try {
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      setIsLoading(false);
      await deleteSharedWishlistItem(itemId);
      await loadWishlist({ showLoading: false });
      toast.success('Item deleted');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
      await loadWishlist({ showLoading: false });
    }
  };

  const handleThinkingAbout = async (itemId) => {
    try {
      // Find the item index and optimistically update UI
      const itemIndex = items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        // Create a copy of the items array
        const updatedItems = [...items];
        // Toggle the thinking_about status optimistically
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          thinking_about: !updatedItems[itemIndex].thinking_about
        };
        // Update the state immediately
        setItems(updatedItems);
      }

      // Send the request to the server
      const response = await toggleSharedItemThinking(itemId);

      // Only refresh if response doesn't match our optimistic update
      if (response?.data && itemIndex !== -1) {
        const updatedItems = [...items];
        updatedItems[itemIndex] = response.data;
        setItems(updatedItems);
      }
    } catch (error) {
      console.error('Failed to toggle thinking status:', error);
      toast.error('Cannot mark "thinking about" on items you own');
      // Revert optimistic update by refreshing
      await loadWishlist();
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleItemModalClose = () => {
    setSelectedItem(null);
    onClearOpenItemId?.();
  };

  const handleUpdateItems = useCallback(async (skipReload = false) => {
    // If skipReload is true, we're doing an optimistic update and don't need to reload
    if (skipReload) {
      // Just notify parent that items were updated (for cart count, etc.)
      if (onUpdateItems) {
        onUpdateItems();
      }
      return;
    }
    // Otherwise, do a full reload
    await loadWishlist();
  }, [loadWishlist, onUpdateItems]);

  const handleOptimisticUpdateItem = useCallback((itemId, updates) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }, []);

  useEffect(() => {
    if (!optimisticUpdate?.itemId) return;
    handleOptimisticUpdateItem(optimisticUpdate.itemId, optimisticUpdate.updates || {});
  }, [optimisticUpdate?.nonce, optimisticUpdate?.itemId, handleOptimisticUpdateItem]);

  useEffect(() => {
    if (!openItemId) {
      if (selectedItem) {
        setSelectedItem(null);
      }
      return;
    }
    if (!items.length) return;
    const matchedItem = items.find(item => String(item.id) === String(openItemId));
    if (matchedItem) {
      setSelectedItem(matchedItem);
    } else {
      onClearOpenItemId?.();
    }
  }, [openItemId, items, selectedItem, onClearOpenItemId]);

  // Create a "virtual member" object that WishlistCard expects
  const virtualMember = {
    id: `shared-${wishlist.id}`,
    name: wishlistData?.name || wishlist.name,
    wishlist_item_count: items.length,
    is_shared_wishlist: true,
    shared_wishlist_id: wishlist.id,
    owner_count: wishlistData?.owner_count || wishlist.owner_count || 0,
    occasion_date: wishlistData?.occasion_date || wishlist.occasion_date,
    occasion_type: wishlistData?.occasion_type || wishlist.occasion_type
  };

  return (
    <div className="relative">
      <WishlistCard
        member={virtualMember}
        items={items}
        isLoading={isLoading}
        isOwnWishlist={isOwner}
        currentUserId={currentUserId}
        onUpdateItems={handleUpdateItems}
        onDeleteItem={handleDeleteItem}
        onThinkingAbout={handleThinkingAbout}
        onItemClick={handleItemClick}
        onItemModalClose={handleItemModalClose}
        selectedItem={selectedItem}
        currentUserName={currentUserName}
        onCartUpdated={onCartUpdated}
        onOptimisticUpdateItem={handleOptimisticUpdateItem}
      />
    </div>
  );
};

export default SharedWishlistInline;
