// frontend/src/components/DashboardScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, getWishlistItems, getUpcomingEvent, createWishlistItem } from '../services/api'; // Import createWishlistItem
import WishlistCard from './WishlistCard';
import GiftReminder from './GiftReminder';
import AddItemForm from './AddItemForm';
import { motion, AnimatePresence } from 'framer-motion';

const DashboardScreen = () => {
  const { selectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const [viewingMember, setViewingMember] = useState(selectedUser);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [error, setError] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false); // State to control AddItemForm visibility

  // Fetch family members
  useEffect(() => {
    const fetchMembers = async () => {
      if (familyMembers.length === 0) {
        try {
          const response = await getFamilyMembers();
          setFamilyMembers(response.data);
        } catch (err) {
          console.error("Failed to fetch family members for dashboard:", err);
          setError("Could not load family members.");
        }
      }
    };
    fetchMembers();
  }, [familyMembers, setFamilyMembers]);

  // Fetch upcoming event
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getUpcomingEvent();
        setUpcomingEvent(response.data);
      } catch (err) {
        console.error("Failed to fetch upcoming event:", err);
      }
    };
    fetchEvent();
  }, []);

  // Fetch wishlist items for the currently viewed member
  useEffect(() => {
    if (viewingMember && selectedUser) {
      const fetchItems = async () => {
        setIsLoadingItems(true);
        setError('');
        try {
          const response = await getWishlistItems(viewingMember.id);
          setWishlistItems(response.data);
        } catch (err) {
          console.error(`Failed to fetch wishlist items for ${viewingMember.name}:`, err);
          setError(`Could not load ${viewingMember.name}'s wishlist.`);
          setWishlistItems([]);
        } finally {
          setIsLoadingItems(false);
        }
      };
      fetchItems();
    }
  }, [viewingMember, selectedUser]);

  const handleSelectViewingMember = (member) => {
    setViewingMember(member);
    setIsAddingItem(false); // Close the add item form when viewing another member's list
  };

  const refreshWishlistItems = async () => {
    if (viewingMember && selectedUser) {
      setIsLoadingItems(true);
      try {
        const response = await getWishlistItems(viewingMember.id);
        setWishlistItems(response.data);
      } catch (err) {
        console.error("Error refreshing wishlist items:", err);
        setError("Failed to refresh items.");
      } finally {
        setIsLoadingItems(false);
      }
    }
  };

  const handleAddItem = async (newItem) => {
    if (viewingMember?.id === selectedUser?.id) {
      try {
        await createWishlistItem(viewingMember.id, newItem);
        refreshWishlistItems();
        setIsAddingItem(false); // Close the form after successful add
      } catch (error) {
        console.error("Error adding item:", error);
        setError("Failed to add item.");
      }
    } else {
      console.warn("Cannot add items to another user's wishlist.");
      setError("Cannot add items to another user's wishlist.");
    }
  };

  const handleOpenAddItemForm = () => {
    setIsAddingItem(true);
  };

  const handleCloseAddItemForm = () => {
    setIsAddingItem(false);
  };

  if (!selectedUser) {
    return <div className="text-center p-10">Please select a user.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
            {viewingMember?.id === selectedUser.id ? "Your Wishlist" : `${viewingMember?.name || ''}'s Wishlist`}
          </h1>
          <p className="text-gray-600 mt-1">
            {viewingMember?.id === selectedUser.id ? "Manage your wishes or " : "Browse wishes and "}
            see what others are hoping for!
          </p>
        </div>
        {upcomingEvent && <GiftReminder eventName={upcomingEvent.event_name} displayText={upcomingEvent.display_text} />}
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-center">{error}</p>}

      {/* User selection cards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-3">Browse Wishlists:</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {familyMembers.map(member => (
            <motion.button
              key={member.id}
              onClick={() => handleSelectViewingMember(member)}
              className={`p-4 rounded-lg shadow-md transition-all duration-200 ease-in-out
                            ${viewingMember?.id === member.id
                              ? 'bg-primary text-white ring-2 ring-offset-2 ring-primary'
                              : 'bg-white hover:bg-gray-50 card-shadow text-gray-700'}`}
              whileHover={{ y: -3 }}
            >
              <p className="font-semibold text-lg">{member.name}</p>
              <p className="text-xs">{member.wishlist_item_count} items</p>
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
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
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
          isLoading={isLoadingItems}
          isOwnWishlist={viewingMember.id === selectedUser.id}
          currentUserId={selectedUser.id}
          onUpdateItems={refreshWishlistItems}
        />
      )}
    </motion.div>
  );
};

export default DashboardScreen;