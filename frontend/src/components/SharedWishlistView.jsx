// SharedWishlistView.jsx - Component for viewing and managing shared wishlist items
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Check, Baby, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getSharedWishlist,
  deleteSharedWishlistItem,
  toggleSharedItemThinking,
  toggleSharedItemPurchased
} from '../services/api';
import WishlistCard from './WishlistCard';

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
  const [selectedItem, setSelectedItem] = useState(null);

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

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteSharedWishlistItem(itemId);
      await loadWishlist(); // Refresh to get updated list
      toast.success('Item deleted');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
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
  };

  const handleUpdateItems = useCallback(async (skipReload = false) => {
    // If skipReload is true, we're doing an optimistic update and don't need to reload
    if (!skipReload) {
      await loadWishlist();
    }
  }, [loadWishlist]);

  // Create a "virtual member" object that WishlistCard expects
  const virtualMember = {
    id: `shared-${wishlist.id}`,
    name: wishlistData?.name || wishlist.name,
    wishlist_item_count: items.length,
    is_shared_wishlist: true,
    shared_wishlist_id: wishlist.id,
    owner_count: wishlistData?.owner_count || 0
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Baby className="w-5 h-5 text-fuchsia-500" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {wishlistData?.name || wishlist.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{wishlistData?.owner_count || 0} co-owner{(wishlistData?.owner_count || 0) !== 1 ? 's' : ''}</span>
                {isOwner && (
                  <span className="px-2 py-0.5 bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-600
                    dark:text-fuchsia-400 rounded-full text-xs font-medium">
                    You're an owner
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Purchase Visibility Notice for Owners */}
          {isOwner && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border
              border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300
              flex items-start gap-2">
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>As a co-owner, you can see which items have been purchased to coordinate gift-giving.</span>
            </div>
          )}
        </div>
      </div>

      {/* Content - Use WishlistCard for consistent styling */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        />
      </div>
    </div>
  );
};

export default SharedWishlistView;
