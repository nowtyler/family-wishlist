// frontend/src/components/DashboardScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, getWishlistItems, getUpcomingEvent } from '../services/api';
import WishlistCard from './WishlistCard'; // We'll define this
import GiftReminder from './GiftReminder'; // We'll define this
import { motion, AnimatePresence } from 'framer-motion';

const DashboardScreen = () => {
  const { selectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const [viewingMember, setViewingMember] = useState(selectedUser); // Who's wishlist are we looking at?
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [error, setError] = useState('');

  // Fetch family members if not already loaded (e.g., on direct navigation)
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
    if (viewingMember && selectedUser) { // Ensure selectedUser (current viewer) is available for X-Current-User-Id
      const fetchItems = async () => {
        setIsLoadingItems(true);
        setError('');
        try {
          // The selectedUser.id is passed in the header by api.js setup
          const response = await getWishlistItems(viewingMember.id);
          setWishlistItems(response.data);
        } catch (err) {
          console.error(`Failed to fetch wishlist items for ${viewingMember.name}:`, err);
          setError(`Could not load ${viewingMember.name}'s wishlist.`);
          setWishlistItems([]); // Clear items on error
        } finally {
          setIsLoadingItems(false);
        }
      };
      fetchItems();
    }
  }, [viewingMember, selectedUser]); // Re-fetch if viewingMember changes or selectedUser (viewer context) changes

  const handleSelectViewingMember = (member) => {
    setViewingMember(member);
  };
  
  // Callback to refresh items, e.g., after adding/editing an item
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
      
      {/* Wishlist items for viewingMember */}
      {viewingMember && (
        <WishlistCard 
          member={viewingMember} 
          items={wishlistItems} 
          isLoading={isLoadingItems}
          isOwnWishlist={viewingMember.id === selectedUser.id}
          currentUserId={selectedUser.id} // Pass the actual logged-in user's ID
          onUpdateItems={refreshWishlistItems} // Pass the refresh function
        />
      )}
    </motion.div>
  );
};

export default DashboardScreen;