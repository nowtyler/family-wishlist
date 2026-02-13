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
  getMigrations,
  getShoppingCartItems,
  getUserProfile,
  getNotifications,
  getSharedWishlists,
  getSharedWishlistItems,
  createSharedWishlistItem
} from '../services/api';
import WishlistCard from './WishlistCard';
import EnhancedUpcomingEventsBanner from './EnhancedUpcomingEventsBanner';
import AddItemForm from './AddItemForm';
import SchemaAlertModal from './SchemaAlertModal';
import ExternalWishlistsButton from './ExternalWishlistsButton';
import ShoppingCartDrawer from './ShoppingCartDrawer';
import UserPreferencesDropdown from './UserPreferencesDropdown';
import FloatingActionMenu from './FloatingActionMenu';
import SharedWishlistManager from './SharedWishlistManager';
import SharedWishlistInline from './SharedWishlistInline';
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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState(0); // Add refresh timestamp to prevent too frequent refreshes
  const [isFetchingInProgress, setIsFetchingInProgress] = useState(false); // Track ongoing fetches
  const minRefreshInterval = 2000; // Minimum 2 seconds between refreshes
  const memberIdFromParams = searchParams.get('memberId');
  const itemIdFromParams = searchParams.get('itemId');
  const sharedWishlistIdFromParams = searchParams.get('sharedWishlistId');
  const sharedWishlistItemIdFromParams = searchParams.get('sharedWishlistItemId');

  // Shared wishlists state
  const [isSharedWishlistsOpen, setIsSharedWishlistsOpen] = useState(false);
  const [sharedWishlists, setSharedWishlists] = useState([]);
  const [selectedSharedWishlist, setSelectedSharedWishlist] = useState(null);
  const [sharedWishlistReloadTrigger, setSharedWishlistReloadTrigger] = useState(0);
  const [sharedWishlistClearTrigger, setSharedWishlistClearTrigger] = useState(0);
  const [sharedWishlistOptimisticUpdate, setSharedWishlistOptimisticUpdate] = useState(null);

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

  const refreshCartCount = useCallback(async (nextCount) => {
    if (typeof nextCount === 'number') {
      setCartCount(nextCount);
      return;
    }
    if (!selectedUser?.id) return;
    try {
      const response = await getShoppingCartItems(selectedUser.id);
      setCartCount(Array.isArray(response?.data) ? response.data.length : 0);
    } catch (error) {
      console.error('Failed to load shopping cart count:', error);
    }
  }, [selectedUser?.id]);

  const refreshNotificationCount = useCallback(async () => {
    if (!selectedUser?.id) return;
    try {
      const response = await getNotifications(selectedUser.id);
      setNotificationCount(Array.isArray(response?.data) ? response.data.length : 0);
    } catch (error) {
      // silently fail — notifications are non-critical
    }
  }, [selectedUser?.id]);

  const refreshSharedWishlists = useCallback(async () => {
    if (!selectedUser?.id) return;
    try {
      const response = await getSharedWishlists();
      setSharedWishlists(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      // silently fail — shared wishlists are non-critical on initial load
    }
  }, [selectedUser?.id]);

  const handleSelectSharedWishlist = useCallback((wishlist) => {
    setSelectedSharedWishlist(wishlist);
    setViewingMember(null); // Clear regular member when viewing shared wishlist
    setIsSharedWishlistsOpen(false);
    setIsAddingItem(false);
    setIsPreferencesOpen(false);
    updateSearchParams(
      { sharedWishlistId: wishlist?.id, memberId: null },
      { replace: false }
    );
  }, [updateSearchParams]);

  const handleBackFromSharedWishlist = useCallback(() => {
    setSelectedSharedWishlist(null);
    // Return to user's own wishlist
    setViewingMember(selectedUser);
    updateSearchParams(
      { sharedWishlistId: null, memberId: null },
      { replace: false }
    );
    refreshSharedWishlists();
  }, [refreshSharedWishlists, updateSearchParams, selectedUser]);

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

  useEffect(() => {
    refreshCartCount();
    refreshNotificationCount();
    refreshSharedWishlists();
  }, [refreshCartCount, refreshNotificationCount, refreshSharedWishlists]);


  const handleSelectViewingMember = (member) => {
    setViewingMember(member);
    setSelectedSharedWishlist(null); // Clear shared wishlist when selecting a member
    setIsAddingItem(false);
    setIsPreferencesOpen(false);
    updateSearchParams(
      {
        memberId: member?.id === selectedUser?.id ? null : member?.id,
        sharedWishlistId: null,
        sharedWishlistItemId: null
      },
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
    // Skip if viewing a shared wishlist
    if (sharedWishlistIdFromParams) return;

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
  }, [memberIdFromParams, sharedWishlistIdFromParams, familyMembers, selectedUser?.id, viewingMember?.id, updateSearchParams]);

  // Sync shared wishlist with URL state so browser back/forward works
  useEffect(() => {
    if (!selectedUser?.id) return;

    // If we have a sharedWishlistId in URL, sync state
    if (sharedWishlistIdFromParams) {
      const matchedWishlist = sharedWishlists.find(
        w => String(w.id) === String(sharedWishlistIdFromParams)
      );

      if (matchedWishlist) {
        if (selectedSharedWishlist?.id !== matchedWishlist.id) {
          setSelectedSharedWishlist(matchedWishlist);
          setViewingMember(null);
        }
      } else if (sharedWishlists.length > 0) {
        // Wishlist not found in list, clear the URL param
        updateSearchParams({ sharedWishlistId: null }, { replace: true });
      }
    } else if (selectedSharedWishlist && !sharedWishlistIdFromParams) {
      // URL param was cleared (e.g., browser back), clear state
      setSelectedSharedWishlist(null);
      // Restore to user's own wishlist if no member is selected
      if (!memberIdFromParams && !viewingMember) {
        setViewingMember(selectedUser);
      }
    }
  }, [sharedWishlistIdFromParams, sharedWishlists, selectedUser?.id, selectedSharedWishlist?.id, memberIdFromParams, viewingMember, updateSearchParams]);

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
    // Check if we're adding to a shared wishlist
    if (selectedSharedWishlist) {
      // Adding to shared wishlist - check if user is an owner
      const isOwner = selectedSharedWishlist.owners?.some(o => o.id === selectedUser?.id);
      if (!isOwner) {
        toast.error("Only co-owners can add items to this shared wishlist.");
        return;
      }

      try {
        setIsLoading(true);
        await createSharedWishlistItem(selectedSharedWishlist.id, newItem);
        // Trigger reload of SharedWishlistInline component
        setSharedWishlistReloadTrigger(prev => prev + 1);
        setIsAddingItem(false);
        toast.success("Item added to shared wishlist.");
      } catch (error) {
        console.error("Error adding item to shared wishlist:", error);
        toast.error("Failed to add item to shared wishlist.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Adding to personal wishlist
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

  // Unified refresh handler that detects context (personal vs shared wishlist)
  const handleRefreshWishlist = useCallback(async (sharedWishlistIdParam = null) => {
    if (selectedSharedWishlist?.id) {
      // Refreshing shared wishlist - increment the reload trigger to refresh SharedWishlistInline
      setSharedWishlistReloadTrigger(prev => prev + 1);
    } else if (viewingMember?.id) {
      // Refreshing personal wishlist
      await refreshWishlistItems(true, viewingMember.id);
    }
  }, [selectedSharedWishlist?.id, viewingMember?.id, refreshWishlistItems]);

  const handleClearWishlist = useCallback(async () => {
    if (selectedSharedWishlist) {
      setSharedWishlistClearTrigger((prev) => prev + 1);
      await refreshSharedWishlists();
      return;
    }

    await refreshWishlistItems(true);
  }, [selectedSharedWishlist, refreshSharedWishlists, refreshWishlistItems]);

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

  const handleCartChanged = useCallback((change = null) => {
    if (selectedSharedWishlist && change?.sharedWishlistItemId) {
      setSharedWishlistOptimisticUpdate({
        itemId: change.sharedWishlistItemId,
        updates: { purchased_by: null },
        nonce: Date.now()
      });
      if (change.revert) {
        setSharedWishlistReloadTrigger((prev) => prev + 1);
      }
      return;
    }

    if (viewingMember?.id) {
      refreshWishlistItems(true);
    }
  }, [selectedSharedWishlist, viewingMember?.id, refreshWishlistItems]);

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
        // Optimistically remove the item immediately
        setWishlistItems(prev => prev.filter(item => item.id !== itemId));
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

    if (isLoading) return;
    if (!wishlistItems.length) return;

    const matchedItem = wishlistItems.find(item => String(item.id) === String(itemIdFromParams));
    if (!matchedItem) {
      updateSearchParams({ itemId: null }, { replace: true });
      return;
    }

    if (!selectedItem || selectedItem.id !== matchedItem.id) {
      setSelectedItem(matchedItem);
    }
  }, [itemIdFromParams, wishlistItems, selectedItem, updateSearchParams, isLoading]);

  const handleOpenWishlistItemFromCart = useCallback(async (payload) => {
    if (!payload) return;
    const { memberId, itemId, sharedWishlistId, sharedWishlistItemId } = payload;

    if (sharedWishlistId && sharedWishlistItemId) {
      let targetWishlist = sharedWishlists.find(
        (wishlist) => String(wishlist.id) === String(sharedWishlistId)
      );

      if (!targetWishlist) {
        try {
          const response = await getSharedWishlists();
          const nextWishlists = Array.isArray(response?.data) ? response.data : [];
          setSharedWishlists(nextWishlists);
          targetWishlist = nextWishlists.find(
            (wishlist) => String(wishlist.id) === String(sharedWishlistId)
          );
        } catch (error) {
          console.error('Failed to load shared wishlists for cart item:', error);
        }
      }

      if (targetWishlist) {
        setSelectedSharedWishlist(targetWishlist);
        setViewingMember(null);
        setIsSharedWishlistsOpen(false);
        setIsAddingItem(false);
        setIsPreferencesOpen(false);
      }

      updateSearchParams(
        {
          sharedWishlistId,
          sharedWishlistItemId,
          memberId: null,
          itemId: null
        },
        { replace: false }
      );
      return;
    }

    if (!memberId || !itemId) return;
    let targetMember =
      familyMembers.find((member) => Number(member.id) === Number(memberId))
      || (selectedUser?.id === memberId ? selectedUser : null);

    if (!targetMember) {
      try {
        const userResponse = await getUserProfile(memberId);
        if (userResponse?.data) {
          targetMember = userResponse.data;
          setFamilyMembers((prev) => {
            if (Array.isArray(prev) && prev.some((member) => Number(member.id) === Number(memberId))) {
              return prev;
            }
            return Array.isArray(prev) ? [...prev, userResponse.data] : [userResponse.data];
          });
        }
      } catch (error) {
        console.error('Failed to load member for cart item:', error);
      }
    }

    if (targetMember) {
      handleSelectViewingMember(targetMember);
    }

    setIsLoading(true);
    setWishlistItems([]);
    setSelectedItem(null);
    updateSearchParams(
      {
        memberId: memberId === selectedUser?.id ? null : memberId,
        itemId,
        sharedWishlistId: null,
        sharedWishlistItemId: null
      },
      { replace: false }
    );

    try {
      const itemsResponse = await getWishlistItems(memberId);
      const nextItems = itemsResponse?.data || [];
      setWishlistItems(nextItems);
      const matchedItem = nextItems.find(item => String(item.id) === String(itemId));
      if (matchedItem) {
        setSelectedItem(matchedItem);
      }
    } catch (error) {
      console.error('Failed to load wishlist items for cart item:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    familyMembers,
    selectedUser?.id,
    sharedWishlists,
    handleSelectViewingMember,
    updateSearchParams,
    getWishlistItems,
    getUserProfile,
    getSharedWishlists,
    setFamilyMembers
  ]);

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
        onClearWishlist={handleClearWishlist}
        viewingMember={viewingMember}
        selectedSharedWishlist={selectedSharedWishlist}
        onHouseholdUpdate={handleHouseholdUpdate}
        onRefreshWishlist={handleRefreshWishlist}
        onOpenSharedWishlists={() => setIsSharedWishlistsOpen(true)}
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
            <EnhancedUpcomingEventsBanner
              familyMembers={familyMembers}
              sharedWishlists={sharedWishlists}
            />
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

          {/* Wishlist items for viewingMember OR selectedSharedWishlist */}
          {selectedSharedWishlist ? (
            <SharedWishlistInline
              wishlist={selectedSharedWishlist}
              currentUserId={selectedUser?.id}
              currentUserName={selectedUser?.name}
              isOwner={selectedSharedWishlist.owners?.some(o => o.id === selectedUser?.id)}
              onUpdateItems={refreshSharedWishlists}
              onCartUpdated={refreshCartCount}
              reloadTrigger={sharedWishlistReloadTrigger}
              clearTrigger={sharedWishlistClearTrigger}
              optimisticUpdate={sharedWishlistOptimisticUpdate}
              openItemId={sharedWishlistItemIdFromParams}
              onClearOpenItemId={() => updateSearchParams({ sharedWishlistItemId: null }, { replace: false })}
            />
          ) : viewingMember ? (
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
                onItemClick={handleItemClick}
                onItemModalClose={handleItemModalClose}
                selectedItem={selectedItem}
                onCartUpdated={refreshCartCount}
                currentUserName={selectedUser?.name}
              />
            </div>
          ) : null}

          {/* Floating Action Menu - Unified menu for all quick actions */}
          {(viewingMember || selectedSharedWishlist) && (
            <>
              <FloatingActionMenu
                isOwnWishlist={
                  selectedSharedWishlist
                    ? selectedSharedWishlist.owners?.some(o => o.id === selectedUser?.id)
                    : (viewingMember?.id === selectedUser?.id || isAdmin)
                }
                viewingMember={viewingMember}
                selectedSharedWishlist={selectedSharedWishlist}
                onAddItem={handleOpenAddItemForm}
                onReturnHome={() => handleSelectViewingMember(selectedUser)}
                onOpenShoppingCart={() => setIsCartOpen(true)}
                onOpenExternalWishlists={() => setIsExternalWishlistsOpen(true)}
                onOpenPreferences={() => setIsPreferencesOpen(true)}
                onOpenSharedWishlists={() => setIsSharedWishlistsOpen(true)}
                onSelectMember={handleSelectViewingMember}
                onSelectSharedWishlist={handleSelectSharedWishlist}
                familyMembers={familyMembers}
                sharedWishlists={sharedWishlists}
                selectedUser={selectedUser}
                isHidden={isAddingItem || selectedItem}
                cartCount={cartCount}
                notificationCount={notificationCount}
              />

              {/* Hidden External Wishlists Button - Only renders modal, triggered from FloatingActionMenu */}
              {viewingMember && (
                <ExternalWishlistsButton
                  member={viewingMember}
                  variant="hidden"
                  externalOpen={isExternalWishlistsOpen}
                  onExternalClose={() => setIsExternalWishlistsOpen(false)}
                />
              )}

              {viewingMember && (
                <UserPreferencesDropdown
                  member={viewingMember}
                  isOwner={viewingMember.id === selectedUser.id || isAdmin}
                  currentUserId={selectedUser.id}
                  onUpdateSuccess={handlePreferencesUpdate}
                  isOpen={isPreferencesOpen}
                  onOpenChange={setIsPreferencesOpen}
                  hideTrigger
                />
              )}
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
                    wishlistId={selectedSharedWishlist ? selectedSharedWishlist.id : viewingMember.id}
                    isSharedWishlist={!!selectedSharedWishlist}
                    onAddItem={handleAddItem}
                    onClose={handleCloseAddItemForm}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {viewingMember && (
        <ShoppingCartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          defaultRecipientId={viewingMember?.id}
          onCartUpdated={refreshCartCount}
          onCartChanged={handleCartChanged}
          onOpenWishlistItem={(payload) => {
            handleOpenWishlistItemFromCart(payload);
          }}
          onNotificationCountUpdate={setNotificationCount}
        />
      )}

      {/* Shared Wishlists Manager Modal */}
      <SharedWishlistManager
        isOpen={isSharedWishlistsOpen}
        onClose={() => {
          setIsSharedWishlistsOpen(false);
          refreshSharedWishlists();
        }}
        onSelectWishlist={handleSelectSharedWishlist}
        currentUserId={selectedUser?.id}
      />
    </>
  );
};

export default DashboardScreen;
