// frontend/src/components/DashboardScreen.jsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, getWishlistItems, getUpcomingEvent, createWishlistItem, deleteWishlistItem, toggleThinkingAbout, markPurchased, getMigrations } from '../services/api'; 
import WishlistCard from './WishlistCard';
import GiftReminder from './GiftReminder';
import AddItemForm from './AddItemForm';
import SchemaAlertModal from './SchemaAlertModal';
import ExternalWishlistsButton from './ExternalWishlistsButton'; // Confirm this import exists
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Gift, AlertTriangle, Home, Calendar } from 'lucide-react';

const DashboardScreen = ({ onViewingMemberChange }) => {
  const { selectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';
  const [viewingMember, setViewingMember] = useState(selectedUser); // Initialize with selectedUser
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false); // State to control AddItemForm visibility
  const [isBrowserExpanded, setBrowserExpanded] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // Add this state to track open modal

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
    setBrowserExpanded(false); // Collapse after selection
    setIsAddingItem(false);
    // Notify parent about the viewing member change
    if (onViewingMemberChange) {
      onViewingMemberChange(member);
    }
  };

  // Also notify on initial render when selectedUser is set as viewingMember
  useEffect(() => {
    if (viewingMember && onViewingMemberChange) {
      onViewingMemberChange(viewingMember);
    }
  }, [viewingMember?.id, onViewingMemberChange]);

  const handleAddItem = async (newItem) => {
    if (viewingMember?.id === selectedUser?.id || isAdmin) {
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

  // Pass this function to parent components
  const refreshWishlistItems = async () => {
    if (!viewingMember?.id) return;
    
    try {
      setIsLoading(true);
      const response = await getWishlistItems(viewingMember.id);
      setWishlistItems(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      console.error("Error refreshing wishlist items:", err);
      setError("Failed to refresh items.");
      setWishlistItems([]); // Ensure empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  // Make it available to the props passed from parent
  React.useEffect(() => {
    if (window.refreshWishlistItems !== refreshWishlistItems) {
      window.refreshWishlistItems = refreshWishlistItems;
    }
  }, []);

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

  // Check schema on mount
  useEffect(() => {
    const checkSchema = async () => {
      try {
        const response = await getMigrations();
        if (response.data.needs_upgrade) {
          setNeedsUpgrade(true);
          setShowUpgradeAlert(true);
        }
      } catch (err) {
        console.error('Failed to check schema:', err);
      }
    };

    checkSchema();
  }, []);

  const handleCloseUpgradeAlert = () => {
    setShowUpgradeAlert(false);
  };

  // Add this function to calculate days until birthday
  const getDaysUntilBirthday = (birthdate) => {
    if (!birthdate) return null;
    
    try {
      // Parse the birthdate (format: YYYY-MM-DD)
      const [year, month, day] = birthdate.split('-').map(num => parseInt(num, 10));
      
      // Create date objects for today and the next birthday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Create this year's birthday
      const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
      
      // If birthday has already passed this year, get next year's birthday
      if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(today.getFullYear() + 1);
      }
      
      // Calculate difference in days
      const diffTime = Math.abs(birthdayThisYear - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        month,
        day,
        daysUntil: diffDays,
        date: birthdayThisYear
      };
    } catch (err) {
      console.error('Error calculating birthday:', err);
      return null;
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

  // Add these handler functions for the WishlistCard component
  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleItemModalClose = () => {
    setSelectedItem(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <AnimatePresence>
        {showUpgradeAlert && (
          <SchemaAlertModal
            isOpen={showUpgradeAlert}
            onClose={handleCloseUpgradeAlert}
          />
        )}
      </AnimatePresence>

      {upcomingEvent && <GiftReminder eventName={upcomingEvent.event_name} displayText={upcomingEvent.display_text} />}

      {/* Schema Warning Banner */}
      {needsUpgrade && !isAdmin && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={18} />
            <p className="text-yellow-800 dark:text-yellow-200">
              Database update required. Some features may be limited until an administrator performs the update.
            </p>
          </div>
        </div>
      )}
      
      {/* Header section - Improved mobile layout with birthday information */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.15),0_4px_6px_-4px_rgba(0,0,0,0.15)]">
        <div className="w-full md:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
              {viewingMember?.id === selectedUser.id ? "Your Wishlist" : `${viewingMember?.name || ''}'s Wishlist`}
            </h1>
            
            {/* Birthday information tag - Only show when viewing someone else's list */}
            {viewingMember?.id !== selectedUser?.id && viewingMember?.birthdate && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm whitespace-nowrap">
                <Calendar size={14} />
                {(() => {
                  const birthday = getDaysUntilBirthday(viewingMember.birthdate);
                  if (!birthday) return null;
                  
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return (
                    <span>
                      {monthNames[birthday.month - 1]} {birthday.day}
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/50 rounded-full text-xs">
                        {birthday.daysUntil} {birthday.daysUntil === 1 ? 'day' : 'days'}
                      </span>
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {viewingMember?.id === selectedUser.id ? "Manage your wishes or " : "Browse wishes and "}
            see what others are hoping for!
          </p>
        </div>
        
        {/* External Wishlists Button - full width on mobile, auto width on larger screens */}
        {viewingMember && <div className="w-full md:w-auto">
          <ExternalWishlistsButton member={viewingMember} />
        </div>}
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-center">{error}</p>}

      {/* Collapsible Browse Wishlist Section - Enhanced with gradient styling */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.15),0_4px_6px_-4px_rgba(0,0,0,0.15)] overflow-hidden">
        <button
          onClick={() => setBrowserExpanded(!isBrowserExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 hover:from-sky-100 hover:to-indigo-100 dark:hover:from-sky-900/30 dark:hover:to-indigo-900/30 transition-colors duration-200"
        >
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary dark:text-primary-400" />
            <span className="font-semibold text-gray-800 dark:text-white">
              Browse Wishlists
            </span>
            {Array.isArray(familyMembers) && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({familyMembers.filter(m => !m.name.toLowerCase().includes('admin')).length})
              </span>
            )}
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              View Others
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${
              isBrowserExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <motion.div
          initial={false}
          animate={{
            height: isBrowserExpanded ? 'auto' : 0,
            opacity: isBrowserExpanded ? 1 : 0
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-gray-100 dark:border-gray-700"
        >
          <div className="p-4 grid gap-2">
            {Array.isArray(familyMembers) && familyMembers
              .filter(member => !member.name.toLowerCase().includes('admin'))
              .map(member => (
                <motion.button
                  key={member.id}
                  onClick={() => handleSelectViewingMember(member)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200
                    ${viewingMember?.id === member.id
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                >
                  <span className="font-medium">{member.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${viewingMember?.id === member.id
                      ? 'bg-white/20'
                      : 'bg-white dark:bg-gray-600'
                    }`}
                  >
                    {member.wishlist_item_count}
                  </span>
                </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Wishlist items for viewingMember */}
      {viewingMember && (
        <div className="relative">
          <WishlistCard
            member={viewingMember}
            items={Array.isArray(wishlistItems) ? wishlistItems : []}
            isLoading={isLoading}
            isOwnWishlist={isAdmin || viewingMember.id === selectedUser.id}
            currentUserId={selectedUser.id}
            onUpdateItems={refreshWishlistItems}
            onDeleteItem={handleDeleteItem}
            onThinkingAbout={handleThinkingAbout}
            onMarkPurchased={handleMarkPurchased}
            onItemClick={handleItemClick}
            onItemModalClose={handleItemModalClose}
            selectedItem={selectedItem}
          />
        </div>
      )}

      {/* Floating Add Button - Updated to hide when modal is open */}
      <AnimatePresence>
        {(viewingMember?.id === selectedUser?.id || isAdmin) && !isAddingItem && !selectedItem && (
          <motion.button
            onClick={handleOpenAddItemForm}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 text-white shadow-lg hover:from-sky-600 hover:to-indigo-600 dark:hover:from-sky-500 dark:hover:to-indigo-500 flex items-center justify-center transition-all duration-200 z-10"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Add new item"
          >
            <Plus size={24} />
          </motion.button>
        )}
        
        {/* Floating Home Button - Only shows when viewing someone else's wishlist */}
        {viewingMember?.id !== selectedUser?.id && !isAdmin && !selectedItem && (
          <motion.button
            onClick={() => handleSelectViewingMember(selectedUser)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500 flex items-center justify-center transition-all duration-200 z-10"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Return to your wishlist"
          >
            <Home size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Add Item Form Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
            }}
            onClick={handleCloseAddItemForm} // Close on backdrop click
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl mx-auto my-8 max-h-[90vh] overflow-y-auto"
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
    </motion.div>
  );
};

export default DashboardScreen;