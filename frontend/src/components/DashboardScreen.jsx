// frontend/src/components/DashboardScreen.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { 
  getFamilyMembers, 
  getWishlistItems, 
  getUpcomingEvent, 
  createWishlistItem, 
  deleteWishlistItem, 
  toggleThinkingAbout, 
  markPurchased, 
  getMigrations,
  getUserProfile 
} from '../services/api'; 
import WishlistCard from './WishlistCard';
import EnhancedUpcomingEventsBanner from './EnhancedUpcomingEventsBanner';
import AddItemForm from './AddItemForm';
import SchemaAlertModal from './SchemaAlertModal';
import ExternalWishlistsButton from './ExternalWishlistsButton';
import UserPreferencesDropdown from './UserPreferencesDropdown';
import FloatingActionMenu from './FloatingActionMenu';
import Navbar from './Navbar';
import { useTutorial } from '../contexts/TutorialContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * @param {{ onViewingMemberChange?: (member: any) => void }} props
 */
const DashboardScreen = (props = {}) => {
  const { onViewingMemberChange } = props;
  const { selectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const tutorial = useTutorial();
  const isAdmin = selectedUser?.is_admin;
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewingMember, setViewingMember] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // Track drag operations
  const [isAddingItem, setIsAddingItem] = useState(false); // State to control AddItemForm visibility
  const [isExternalWishlistsOpen, setIsExternalWishlistsOpen] = useState(false); // State for external wishlists modal
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false); // State for preferences modal
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState(0); // Add refresh timestamp to prevent too frequent refreshes
  const [isFetchingInProgress, setIsFetchingInProgress] = useState(false); // Track ongoing fetches
  const minRefreshInterval = 2000; // Minimum 2 seconds between refreshes
  const memberIdFromParams = searchParams.get('memberId');
  const itemIdFromParams = searchParams.get('itemId');

  const updateSearchParams = useCallback((updates, options = {}) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(value));
      }
    });

    setSearchParams(nextParams, options);
  }, [searchParams, setSearchParams]);

  // Replace the initialization effect with a more robust version
  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      if (!selectedUser?.id) return;
      
      setIsLoading(true);

      try {
        // Load family members first if needed - with improved pattern to avoid multiple calls
        if (familyMembers.length === 0) {
          const membersResponse = await getFamilyMembers();
          if (!mounted) return;
          setFamilyMembers(membersResponse.data);
          
          // If this is first load, set viewingMember from the fresh data instead of using selectedUser directly
          // This ensures complete preference data is available
          if (!viewingMember && selectedUser?.id) {
            const freshUserData = membersResponse.data.find(m => m.id === selectedUser.id);
            if (freshUserData) {
              setViewingMember(freshUserData);
            } else {
              // If we can't find the user in family members, get their profile directly
              try {
                const userResponse = await getUserProfile(selectedUser.id);
                if (userResponse?.data) {
                  setViewingMember(userResponse.data);
                } else {
                  setViewingMember(selectedUser); // Last resort fallback
                }
              } catch (err) {
                console.error('Error getting user profile:', err);
                setViewingMember(selectedUser); // Fallback
              }
            }
          }
        }
        // Ensure viewingMember is set (only use this as a fallback)
        else if (!viewingMember) {
          if (!mounted) return;
          setViewingMember(selectedUser);
        }

        // Load items only if we have a valid viewingMember - batch requests
        if (viewingMember?.id) {
          // Only fetch if not currently fetching (prevent duplicate requests)
          if (!isFetchingInProgress) {
            setIsFetchingInProgress(true);
            const [itemsResponse, eventResponse] = await Promise.all([
              getWishlistItems(viewingMember.id),
              getUpcomingEvent()
            ]);
            
            if (!mounted) return;
            setWishlistItems(itemsResponse.data || []);
            setUpcomingEvent(eventResponse.data || null);
            setIsFetchingInProgress(false);
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Dashboard initialization error:', err);
        
        // Check for rate limit error
        if (err.response?.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment before refreshing the page.');
        } else {
          toast.error('Failed to load dashboard data. Please refresh the page.');
        }
        setIsFetchingInProgress(false);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeDashboard();
    return () => { mounted = false; };
  }, [selectedUser?.id, viewingMember?.id, familyMembers.length]);

  // Start tutorial for first-time users after dashboard loads
  useEffect(() => {
    if (!isLoading && viewingMember && tutorial?.startTutorialForNewUser) {
      tutorial.startTutorialForNewUser();
    }
  }, [isLoading, viewingMember, tutorial]);

  const handleSelectViewingMember = (member) => {
    setViewingMember(member);
    setIsAddingItem(false);
    setIsPreferencesOpen(false);
    updateSearchParams(
      { memberId: member?.id === selectedUser?.id ? null : member?.id },
      { replace: false }
    );
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

  // Sync viewing member with URL state so browser back/forward works as expected.
  useEffect(() => {
    if (!selectedUser?.id) return;

    const targetId = memberIdFromParams ? Number(memberIdFromParams) : selectedUser.id;

    if (!familyMembers.length) {
      if (targetId === selectedUser.id && viewingMember?.id !== selectedUser.id) {
        setViewingMember(selectedUser);
      }
      return;
    }

    const matchedMember = familyMembers.find(m => String(m.id) === String(targetId))
      || (selectedUser.id === targetId ? selectedUser : null);

    if (!matchedMember) {
      if (memberIdFromParams) {
        updateSearchParams({ memberId: null }, { replace: true });
      }
      if (viewingMember?.id !== selectedUser.id) {
        setViewingMember(selectedUser);
      }
      return;
    }

    if (viewingMember?.id !== matchedMember.id) {
      setViewingMember(matchedMember);
    }
  }, [memberIdFromParams, familyMembers, selectedUser?.id, viewingMember?.id, updateSearchParams]);

  // Ensure viewing member has the most up-to-date information from family members
  useEffect(() => {
    if (viewingMember?.id && familyMembers.length > 0) {
      // Find the current viewing member in the fresh family members data
      const freshMemberData = familyMembers.find(m => m.id === viewingMember.id);
      if (freshMemberData && JSON.stringify(freshMemberData) !== JSON.stringify(viewingMember)) {
        console.log('Updating viewingMember with fresh data from familyMembers');
        setViewingMember(freshMemberData);
      }
    }
  }, [familyMembers, viewingMember?.id]);

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
      } catch (error) {
        console.error("Error adding item:", error);
        toast.error("Failed to add item.");
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.error("Cannot add items to another user's wishlist.");
    }
  };

  // Add this function to refresh wishlist items with rate limiting
  const refreshWishlistItems = useCallback(async (force = false, memberId = null) => {
    const targetMemberId = memberId || viewingMember?.id;
    if (!targetMemberId) return;

    // Prevent too frequent refreshes unless forced
    const now = Date.now();
    if (!force && now - lastRefreshTimestamp < minRefreshInterval) {
      console.log('Refresh throttled. Try again in a moment.');
      return;
    }

    // For member changes, allow overriding the concurrent fetch check
    if (!force && isFetchingInProgress) {
      console.log('Fetch already in progress. Skipping redundant refresh.');
      return;
    }

    try {
      setIsFetchingInProgress(true);
      setLastRefreshTimestamp(now);

      const response = await getWishlistItems(targetMemberId);

      // Only update if we're still viewing the same member (prevent stale updates)
      if (targetMemberId === viewingMember?.id) {
        setWishlistItems(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err) {
      console.error("Error refreshing wishlist items:", err);

      if (err.response?.status === 429) {
        toast.error("Rate limit exceeded. Please wait a moment before trying again.");
      } else {
        toast.error("Failed to refresh items.");
      }

      // Only clear items if we're still viewing the same member
      if (targetMemberId === viewingMember?.id) {
        setWishlistItems([]); // Ensure empty array on error
      }
    } finally {
      setIsFetchingInProgress(false);
      setIsLoading(false);
    }
  }, [viewingMember?.id, lastRefreshTimestamp, minRefreshInterval, isFetchingInProgress]);

  // Add effect to refresh items when viewingMember changes
  useEffect(() => {
    if (viewingMember?.id) {
      // Clear items immediately to show we're loading new data
      setWishlistItems([]);
      setIsLoading(true);
      // Force refresh and pass the specific member ID
      refreshWishlistItems(true, viewingMember.id);
    }
  }, [viewingMember?.id]);

  // Make it available to the props passed from parent
  React.useEffect(() => {
    if (window.refreshWishlistItems !== refreshWishlistItems) {
      window.refreshWishlistItems = refreshWishlistItems;
    }
  }, [refreshWishlistItems]);

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
        // Refresh family members to update count
        const membersResponse = await getFamilyMembers();
        setFamilyMembers(membersResponse.data);
      } catch (error) {
        console.error("Error deleting item:", error);
        toast.error("Failed to delete item.");
      }
    } else {
      toast.error("Cannot delete items from another user's wishlist.");
    }
  };

  const handleThinkingAbout = async (itemId) => {
    try {
      // Find the item index and optimistically update UI
      const itemIndex = wishlistItems.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        // Create a copy of the wishlist items array
        const updatedItems = [...wishlistItems];
        // Toggle the thinking_about status optimistically
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          thinking_about: !updatedItems[itemIndex].thinking_about
        };
        // Update the state immediately
        setWishlistItems(updatedItems);
      }
      
      // Send the request to the server
      const response = await toggleThinkingAbout(itemId);
      
      // Only refresh if response doesn't match our optimistic update
      if (response?.data && itemIndex !== -1) {
        const updatedItems = [...wishlistItems];
        updatedItems[itemIndex] = response.data;
        setWishlistItems(updatedItems);
      }
    } catch (error) {
      console.error("Error toggling thinking about:", error);
      toast.error("Failed to update thinking about status.");
      // Revert optimistic update by refreshing
      refreshWishlistItems(true);
    }
  };

  const handleMarkPurchased = async (itemId) => {
    try {
      // Find the item index and optimistically update UI
      const itemIndex = wishlistItems.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        // Create a copy of the wishlist items array
        const updatedItems = [...wishlistItems];
        // Toggle the purchased status optimistically
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          purchased: !updatedItems[itemIndex].purchased,
          purchased_by: updatedItems[itemIndex].purchased ? null : selectedUser.id
        };
        // Update the state immediately
        setWishlistItems(updatedItems);
      }
      
      // Send the request to the server
      const response = await markPurchased(itemId);
      
      // Update with server response data if available
      if (response?.data && itemIndex !== -1) {
        const updatedItems = [...wishlistItems];
        updatedItems[itemIndex] = response.data;
        setWishlistItems(updatedItems);
      }
      
      // Refresh family members to update count (do this in background)
      const membersResponse = await getFamilyMembers();
      setFamilyMembers(membersResponse.data);
    } catch (error) {
      console.error("Error marking as purchased:", error);
      // Check if the error is because the item is already purchased
      if (error.response?.status === 404) {
        toast.info("Only one person can mark an item as purchased");
      } else {
        toast.error("Failed to mark item as purchased.");
      }
    }
  };

  // Check for schema upgrades
  useEffect(() => {
    const checkSchema = async () => {
      try {
        const migrationsResponse = await getMigrations();
        if (migrationsResponse.data.needs_upgrade) {
          setNeedsUpgrade(true);
          if (isAdmin) {
            setShowUpgradeAlert(true);
          }
        }
      } catch (err) {
        console.error('Failed to check migrations:', err);
      }
    };
    
    checkSchema();
  }, [isAdmin]);

  const handleCloseUpgradeAlert = () => {
    setShowUpgradeAlert(false);
  };

  const getDaysUntilBirthday = (birthday) => {
    if (!birthday) return null;
    
    try {
      const today = new Date();
      const birthdayDate = new Date(birthday);
      
      // Set this year's birthday
      const thisYearBirthday = new Date(today.getFullYear(), birthdayDate.getMonth(), birthdayDate.getDate());
      
      // If this year's birthday has passed, calculate next year's
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      console.error('Error calculating birthday:', error);
      return null;
    }
  };

  // Global mouse event handlers for drag detection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Small delay to ensure text selection is complete
      setTimeout(() => {
        setIsDragging(false);
      }, 100);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const handleItemClick = (item) => {
    setSelectedItem(item);
    updateSearchParams({ itemId: item?.id }, { replace: true });
  };

  const handleItemModalClose = () => {
    setSelectedItem(null);
    updateSearchParams({ itemId: null }, { replace: true });
  };

  // Sync item modal with URL state for back/forward behavior.
  useEffect(() => {
    if (!itemIdFromParams) {
      if (selectedItem) {
        setSelectedItem(null);
      }
      return;
    }

    if (!wishlistItems.length) return;

    const matchedItem = wishlistItems.find(item => String(item.id) === String(itemIdFromParams));
    if (!matchedItem) {
      updateSearchParams({ itemId: null }, { replace: true });
      return;
    }

    if (!selectedItem || selectedItem.id !== matchedItem.id) {
      setSelectedItem(matchedItem);
    }
  }, [itemIdFromParams, wishlistItems, selectedItem, updateSearchParams]);

  const handlePreferencesUpdate = async () => {
    // Refresh family members to get updated preferences
    try {
      const membersResponse = await getFamilyMembers();
      setFamilyMembers(membersResponse.data);
      
      // Update the current viewing member with refreshed data
      if (viewingMember?.id) {
        const updatedMember = membersResponse.data.find(m => m.id === viewingMember.id);
        if (updatedMember) {
          setViewingMember(updatedMember);
        }
      }
    } catch (error) {
      console.error("Error refreshing family members:", error);
    }
  };

  const handleHouseholdUpdate = async () => {
    // Refresh family members and wishlist items after household changes
    try {
      const membersResponse = await getFamilyMembers();
      setFamilyMembers(membersResponse.data);
      
      // Also refresh wishlist items as household changes might affect what's visible
      await refreshWishlistItems();
    } catch (error) {
      console.error("Error refreshing data after household update:", error);
    }
  };

  return (
    <>
      {/* Add Navbar component */}
      <Navbar 
        onClearWishlist={refreshWishlistItems} 
        viewingMember={viewingMember}
        onHouseholdUpdate={handleHouseholdUpdate}
        onRefreshWishlist={refreshWishlistItems}
      />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 sm:space-y-6"
        >
          <AnimatePresence>
            {showUpgradeAlert && (
              <SchemaAlertModal
                isOpen={showUpgradeAlert}
                onClose={handleCloseUpgradeAlert}
              />
            )}
          </AnimatePresence>

          {/* Enhanced Upcoming Events Banner */}
          {familyMembers.length > 0 && (
            <EnhancedUpcomingEventsBanner familyMembers={familyMembers} />
          )}

          {/* Schema Warning Banner */}
          {needsUpgrade && !isAdmin && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <TriangleAlert className="text-yellow-500" size={18} />
                <p className="text-yellow-800 dark:text-yellow-200">
                  Database update required. Some features may be limited until an administrator performs the update.
                </p>
              </div>
            </div>
          )}

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

          {/* Floating Action Menu - Unified menu for all quick actions */}
          {viewingMember && (
            <>
              <FloatingActionMenu
                isOwnWishlist={viewingMember?.id === selectedUser?.id || isAdmin}
                viewingMember={viewingMember}
                onAddItem={handleOpenAddItemForm}
                onReturnHome={() => handleSelectViewingMember(selectedUser)}
                onOpenExternalWishlists={() => setIsExternalWishlistsOpen(true)}
                onOpenPreferences={() => setIsPreferencesOpen(true)}
                onSelectMember={handleSelectViewingMember}
                familyMembers={familyMembers}
                selectedUser={selectedUser}
                isHidden={isAddingItem || selectedItem}
              />

              {/* Hidden External Wishlists Button - Only renders modal, triggered from FloatingActionMenu */}
              <ExternalWishlistsButton
                member={viewingMember}
                variant="hidden"
                externalOpen={isExternalWishlistsOpen}
                onExternalClose={() => setIsExternalWishlistsOpen(false)}
              />

              <UserPreferencesDropdown
                member={viewingMember}
                isOwner={viewingMember.id === selectedUser.id || isAdmin}
                currentUserId={selectedUser.id}
                onUpdateSuccess={handlePreferencesUpdate}
                isOpen={isPreferencesOpen}
                onOpenChange={setIsPreferencesOpen}
                hideTrigger
              />
            </>
          )}

          {/* Add Item Form Modal */}
          <AnimatePresence>
            {isAddingItem && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                onMouseDown={(e) => {
                  // Only track mousedown on the backdrop itself, not the modal content
                  if (e.target === e.currentTarget) {
                    setIsDragging(false);
                  }
                }}
                onMouseUp={(e) => {
                  // Only close if this was a click directly on the backdrop
                  // and not following a text selection drag
                  if (e.target === e.currentTarget && !isDragging && !window.getSelection().toString()) {
                    handleCloseAddItemForm();
                  }
                  setIsDragging(false);
                }}
                onClick={(e) => {
                  // Prevent the click event from closing the dialog if triggered
                  // as part of selecting text or following a drag
                  e.stopPropagation();
                }}
              >
                {/* Backdrop */}
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
                  className="relative w-full max-w-2xl mx-auto my-8 max-h-[90vh] overflow-y-auto z-[110]"
                  onMouseDown={() => {
                    // Track when mouse is pressed down inside the modal
                    setIsDragging(false);
                  }}
                  onMouseMove={() => {
                    // Flag as dragging if mouse moves after mousedown
                    setIsDragging(true);
                  }}
                  onClick={e => e.stopPropagation()} // Prevent closing when clicking the form
                >
                  <AddItemForm
                    wishlistId={viewingMember.id}
                    onAddItem={handleAddItem}
                    onClose={handleCloseAddItemForm}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
};

export default DashboardScreen;
