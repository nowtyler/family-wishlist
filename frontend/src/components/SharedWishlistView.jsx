// SharedWishlistView.jsx - Component for viewing and managing shared wishlist items
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Baby, Users } from 'lucide-react';
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

  const handleOptimisticUpdateItem = useCallback((itemId, updates) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));
    // Also update selectedItem if it's the one being modified
    setSelectedItem(prev =>
      prev && prev.id === itemId ? { ...prev, ...updates } : prev
    );
  }, []);

  // Create a "virtual member" object that WishlistCard expects
  const virtualMember = {
    id: `shared-${wishlist.id}`,
    name: wishlistData?.name || wishlist.name,
    wishlist_item_count: items.length,
    is_shared_wishlist: true,
    shared_wishlist_id: wishlist.id,
    owner_count: wishlistData?.owner_count || 0
  };

  const noSecretsMode = isOwner && (wishlistData?.wishlist_type || wishlist.wishlist_type) === 'no_secrets';

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
                <span>
                  Owned by {wishlistData?.owners?.map((owner, index) => {
                    const isLast = index === wishlistData.owners.length - 1;
                    const isSecondToLast = index === wishlistData.owners.length - 2;
                    return (
                      <span key={owner.id}>
                        {owner.name}
                        {!isLast && (isSecondToLast ? ' and ' : ', ')}
                      </span>
                    );
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Use WishlistCard for consistent styling */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <WishlistCard
          member={virtualMember}
          items={items}
          isLoading={isLoading}
          isOwnWishlist={isOwner}
          noSecretsMode={noSecretsMode}
          currentUserId={currentUserId}
          onUpdateItems={handleUpdateItems}
          onDeleteItem={handleDeleteItem}
          onThinkingAbout={handleThinkingAbout}
          onItemClick={handleItemClick}
          onItemModalClose={handleItemModalClose}
          selectedItem={selectedItem}
          currentUserName={currentUserName}
          onOptimisticUpdateItem={handleOptimisticUpdateItem}
        />
      </div>
    </div>
  );
};

export default SharedWishlistView;
