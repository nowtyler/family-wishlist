// frontend/src/components/DashboardScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, getWishlistItems, getUpcomingEvent, createWishlistItem, deleteWishlistItem, toggleThinkingAbout, markPurchased } from '../services/api'; // Import deleteWishlistItem and toggleThinkingAbout
import WishlistCard from './WishlistCard';
import GiftReminder from './GiftReminder';
import AddItemForm from './AddItemForm';
import { motion, AnimatePresence } from 'framer-motion';

const DashboardScreen = () => {
  const { selectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';
  const [viewingMember, setViewingMember] = useState(selectedUser); // Initialize with selectedUser
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false); // State to control AddItemForm visibility

  console.log('Dashboard State:', { selectedUser, familyMembers, viewingMember }); // Debug log

  // Replace the initialization effect with a more robust version
  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      if (!selectedUser?.id) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Load family members first if needed
        if (familyMembers.length === 0) {
          const membersResponse = await getFamilyMembers();
          if (!mounted) return;
          setFamilyMembers(membersResponse.data);
        }

        // Ensure viewingMember is set
        if (!viewingMember) {
          if (!mounted) return;
          setViewingMember(selectedUser);
        }

        // Load items only if we have a valid viewingMember
        if (viewingMember?.id) {
          const [itemsResponse, eventResponse] = await Promise.all([
            getWishlistItems(viewingMember.id),
            getUpcomingEvent()
          ]);
          
          if (!mounted) return;
          setWishlistItems(itemsResponse.data || []);
          setUpcomingEvent(eventResponse.data || null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Dashboard initialization error:', err);
        setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeDashboard();
    return () => { mounted = false; };
  }, [selectedUser?.id, viewingMember?.id, familyMembers.length]);

  const handleSelectViewingMember = (member) => {
    setViewingMember(member);
    setIsAddingItem(false); // Close the add item form when viewing another member's list
  };

  const handleAddItem = async (newItem) => {
    if (viewingMember?.id === selectedUser?.id) {
      try {
        setIsLoading(true);
        await createWishlistItem(viewingMember.id, newItem);
        // Refresh items
        const itemsResponse = await getWishlistItems(viewingMember.id);
        setWishlistItems(itemsResponse.data || []);
        // Refresh family members to update count
        const membersResponse = await getFamilyMembers();
        setFamilyMembers(membersResponse.data);
        setIsAddingItem(false);
        setError(null);
      } catch (error) {
        console.error("Error adding item:", error);
        setError("Failed to add item.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("Cannot add items to another user's wishlist.");
    }
  };

  // Add effect to refresh items when viewingMember changes
  useEffect(() => {
    if (viewingMember?.id) {
      refreshWishlistItems();
    }
  }, [viewingMember?.id]);

  // Update refreshWishlistItems to be more robust
  const refreshWishlistItems = async () => {
    if (!viewingMember?.id) return;
    
    try {
      const response = await getWishlistItems(viewingMember.id);
      setWishlistItems(response.data || []);
      setError(null);
    } catch (err) {
      console.error("Error refreshing wishlist items:", err);
      setError("Failed to refresh items.");
    }
  };

  const handleOpenAddItemForm = () => {
    setIsAddingItem(true);
  };

  const handleCloseAddItemForm = () => {
    setIsAddingItem(false);
  };

  const handleDeleteItem = async (itemId) => {
    if (viewingMember?.id === selectedUser?.id || isAdmin) {
      try {
        await deleteWishlistItem(itemId);
        refreshWishlistItems();
        // Also refresh family members to update count
        const membersResponse = await getFamilyMembers();
        setFamilyMembers(membersResponse.data);
      } catch (err) {
        console.error("Error deleting item:", err);
        setError("Failed to delete item.");
      }
    }
  };

  const handleThinkingAbout = async (itemId) => {
    try {
      await toggleThinkingAbout(itemId);
      refreshWishlistItems();
    } catch (err) {
      console.error("Error toggling thinking about:", err);
      setError("Failed to update thinking about status.");
    }
  };

  const handleMarkPurchased = async (itemId) => {
    try {
      await markPurchased(itemId);
      refreshWishlistItems();
    } catch (err) {
      console.error("Error marking item as purchased:", err);
      setError("Failed to mark item as purchased.");
    }
  };

  // Early return for loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  if (!selectedUser) {
    return <div className="text-center p-10">No user selected. Please select a user.</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.15),0_4px_6px_-4px_rgba(0,0,0,0.15)]">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
            {viewingMember?.id === selectedUser.id ? "Your Wishlist" : `${viewingMember?.name || ''}'s Wishlist`}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {viewingMember?.id === selectedUser.id ? "Manage your wishes or " : "Browse wishes and "}
            see what others are hoping for!
          </p>
        </div>
        {upcomingEvent && <GiftReminder eventName={upcomingEvent.event_name} displayText={upcomingEvent.display_text} />}
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-center">{error}</p>}

      {/* User selection cards with dark mode */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Browse Wishlists:</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {familyMembers
            .filter(member => !member.name.toLowerCase().includes('admin'))
            .map(member => (
              <motion.button
                key={member.id}
                onClick={() => handleSelectViewingMember(member)}
                className={`p-4 rounded-lg shadow-[0_2px_15px_-3px_rgba(0,0,0,0.15),0_4px_6px_-4px_rgba(0,0,0,0.15)] transition-all duration-200 ease-in-out
                  ${viewingMember?.id === member.id
                    ? 'bg-primary text-white dark:bg-primary-600'
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white'}`}
              >
                <p className="font-semibold text-lg">{member.name}</p>
                <p className="text-xs opacity-75">{member.wishlist_item_count} items</p>
              </motion.button>
          ))}
        </div>
      </div>

      {/* Add Item Button (only for the logged-in user's own wishlist) */}
      {viewingMember?.id === selectedUser.id && (
        <button onClick={handleOpenAddItemForm} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
          Add New Item
        </button>
      )}

      {/* Add Item Form (conditionally rendered as a modal) */}
      <AnimatePresence>
        {isAddingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              minHeight: '100vh',
              minWidth: '100vw'
            }}
            onClick={handleCloseAddItemForm} // Close on backdrop click
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl mx-auto my-8"
              onClick={e => e.stopPropagation()} // Prevent closing when clicking the form
            >
              <AddItemForm
                wishlistId={viewingMember.id}
                onAddItem={handleAddItem}
                onClose={handleCloseAddItemForm}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist items for viewingMember */}
      {viewingMember && (
        <WishlistCard
          member={viewingMember}
          items={wishlistItems}
          isLoading={isLoading}
          isOwnWishlist={isAdmin || viewingMember.id === selectedUser.id}
          currentUserId={selectedUser.id}
          onUpdateItems={refreshWishlistItems}
          onDeleteItem={handleDeleteItem}
          onThinkingAbout={handleThinkingAbout}
          onMarkPurchased={handleMarkPurchased}
        />
      )}
    </motion.div>
  );
};

export default DashboardScreen;