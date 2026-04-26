import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Home, Users, Plus, ShoppingCart, MoreHorizontal, Link2, User, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTutorial } from '../contexts/TutorialContext';
import ExternalWishlistsPanel from './ExternalWishlistsPanel';
import UserPreferencesPanel from './UserPreferencesPanel';

// Haptic feedback helper
const triggerHaptic = (pattern = 10) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Tutorial targets that live inside the nav
const NAV_TUTORIAL_TARGETS = [
  '#tutorial-home-tab',
  '#tutorial-browse-tab',
  '#tutorial-add-item',
  '#tutorial-shopping-cart',
  '#tutorial-more-tab',
];

// Tutorial targets that live in the More menu
const MORE_MENU_TUTORIAL_TARGETS = [
  '#tutorial-external-wishlists',
  '#tutorial-preferences',
];

const BottomTabNav = ({
  isOwnWishlist,
  viewingMember,
  selectedSharedWishlist = null,
  onAddItem,
  onReturnHome,
  onToggleShoppingCart,
  onCloseShoppingCart,
  onPreferencesUpdate = null,
  onOpenSharedWishlists = null,
  isAdmin = false,
  onSelectMember,
  onSelectSharedWishlist,
  familyMembers = [],
  sharedWishlists = [],
  selectedUser = null,
  isHidden = false,
  cartCount = 0,
  notificationCount = 0,
  isCartOpen = false,
}) => {
  const [showBrowseSheet, setShowBrowseSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [moreView, setMoreView] = useState('main');
  const browseSheetRef = useRef(null);
  const moreSheetRef = useRef(null);
  const navRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const tutorial = useTutorial();
  const tutorialTarget = tutorial?.currentStep?.target;
  const isTutorialRunning = Boolean(tutorial?.run);

  // Check if tutorial is targeting nav or more menu items
  const isTutorialNavStep = isTutorialRunning && NAV_TUTORIAL_TARGETS.includes(tutorialTarget);
  const isTutorialMoreStep = isTutorialRunning && MORE_MENU_TUTORIAL_TARGETS.includes(tutorialTarget);

  // Auto-open sheets for tutorial
  useEffect(() => {
    if (!isTutorialRunning) return;

    if (isTutorialMoreStep) {
      setShowMoreSheet(true);
      setShowBrowseSheet(false);
    } else if (tutorialTarget === '#tutorial-browse-wishlists') {
      setShowBrowseSheet(true);
      setShowMoreSheet(false);
    } else if (tutorialTarget && tutorialTarget !== '#tutorial-fab-button') {
      // Close sheets for other tutorial steps unless it's the main FAB step
      if (!NAV_TUTORIAL_TARGETS.includes(tutorialTarget)) {
        setShowBrowseSheet(false);
        setShowMoreSheet(false);
      }
    }
  }, [isTutorialRunning, tutorialTarget, isTutorialMoreStep]);

  // Close sheets on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isTutorialRunning) return;
      if (navRef.current && navRef.current.contains(event.target)) return;

      if (browseSheetRef.current && !browseSheetRef.current.contains(event.target)) {
        setShowBrowseSheet(false);
      }
      if (moreSheetRef.current && !moreSheetRef.current.contains(event.target)) {
        setShowMoreSheet(false);
      }
    };

    if (showBrowseSheet || showMoreSheet) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showBrowseSheet, showMoreSheet, isTutorialRunning]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isTutorialRunning) {
        setShowBrowseSheet(false);
        setShowMoreSheet(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isTutorialRunning]);

  // Lock/unlock body scroll when sheets are open
  useEffect(() => {
    if (showBrowseSheet || showMoreSheet) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [showBrowseSheet, showMoreSheet]);

  // Reset More sub-view whenever the sheet closes
  useEffect(() => {
    if (!showMoreSheet) {
      setMoreView('main');
    }
  }, [showMoreSheet]);

  // Filter shared wishlists that the current user owns
  const ownedSharedWishlists = useMemo(() =>
    sharedWishlists.filter(wishlist =>
      wishlist.owners && wishlist.owners.some(owner => owner.id === selectedUser?.id)
    ), [sharedWishlists, selectedUser?.id]);

  // Get non-admin family members
  const browsableMembers = useMemo(() =>
    familyMembers.filter(m => !m.is_admin), [familyMembers]);

  // Unified browse list
  const unifiedBrowseList = useMemo(() => [
    ...browsableMembers.map(member => ({
      type: 'member',
      id: member.id,
      name: member.name,
      itemCount: member.wishlist_item_count || 0,
      data: member
    })),
    ...sharedWishlists.map(wishlist => ({
      type: 'shared',
      id: `shared-${wishlist.id}`,
      name: wishlist.name.replace(/['']s\s+Wishlist$/i, '').replace(/\s+Wishlist$/i, ''),
      itemCount: wishlist.item_count || wishlist.items?.length || 0,
      data: wishlist
    }))
  ].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [browsableMembers, sharedWishlists]);

  // Color palette for member avatars
  const memberColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-amber-500',
    'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ];

  const getMemberColor = (index) => memberColors[index % memberColors.length];

  // Determine active tab
  const isHomeActive = viewingMember?.id === selectedUser?.id && !selectedSharedWishlist;
  const isBrowseActive = (viewingMember?.id !== selectedUser?.id || selectedSharedWishlist) && showBrowseSheet;
  const hasNotifications = notificationCount > 0;
  const totalCartBadge = hasNotifications ? notificationCount : (cartCount > 0 ? cartCount : null);

  // Check if add button should be shown
  const canAddItem = isOwnWishlist;

  // Handle tab actions
  const handleHomePress = useCallback(() => {
    triggerHaptic();
    setShowBrowseSheet(false);
    setShowMoreSheet(false);
    onCloseShoppingCart?.();
    onReturnHome?.();
  }, [onCloseShoppingCart, onReturnHome]);

  const handleBrowsePress = useCallback(() => {
    triggerHaptic();
    setShowMoreSheet(false);
    setShowBrowseSheet(prev => !prev);
    onCloseShoppingCart?.();
  }, [onCloseShoppingCart]);

  const handleAddPress = useCallback(() => {
    triggerHaptic();
    setShowBrowseSheet(false);
    setShowMoreSheet(false);
    onCloseShoppingCart?.();
    onAddItem?.();
  }, [onAddItem, onCloseShoppingCart]);

  const handleCartPress = useCallback(() => {
    triggerHaptic();
    setShowBrowseSheet(false);
    setShowMoreSheet(false);
    onToggleShoppingCart?.();
  }, [onToggleShoppingCart]);

  const handleMorePress = useCallback(() => {
    triggerHaptic();
    setShowBrowseSheet(false);
    setShowMoreSheet(prev => !prev);
    onCloseShoppingCart?.();
  }, [onCloseShoppingCart]);

  const handleSelectItem = useCallback((item) => {
    triggerHaptic();
    setShowBrowseSheet(false);
    onCloseShoppingCart?.();
    if (item.type === 'member') {
      onSelectMember?.(item.data);
    } else {
      onSelectSharedWishlist?.(item.data);
    }
  }, [onCloseShoppingCart, onSelectMember, onSelectSharedWishlist]);

  // Sheet animation variants
  const sheetVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 100 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
        exit: { opacity: 0, y: 100, transition: { duration: 0.2 } }
      };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const getMemberHouseholdNames = useCallback((member) => {
    const householdNames = (member?.households || [])
      .map((household) => household?.name)
      .filter(Boolean);

    return householdNames.sort((a, b) => a.localeCompare(b));
  }, []);

  const getSharedWishlistHouseholdNames = useCallback((wishlist) => {
    const visibleHouseholds = new Map();

    (wishlist?.owners || []).forEach((owner) => {
      const ownerData = familyMembers.find((member) => member.id === owner.id);
      (ownerData?.households || []).forEach((household) => {
        if (household?.id && household?.name) {
          visibleHouseholds.set(household.id, household.name);
        }
      });
    });

    return Array.from(visibleHouseholds.values()).sort((a, b) => a.localeCompare(b));
  }, [familyMembers]);

  if (isHidden) return null;

  return (
    <>
      {/* Backdrop for sheets */}
      <AnimatePresence>
        {(showBrowseSheet || showMoreSheet) && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40"
            onClick={() => {
              if (!isTutorialRunning) {
                setShowBrowseSheet(false);
                setShowMoreSheet(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Browse Sheet */}
      <AnimatePresence>
        {showBrowseSheet && (
          <div
            className="fixed left-0 right-0 top-0 z-50 flex flex-col justify-end md:inset-0 md:items-center md:justify-end pointer-events-none"
            style={{
              bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <motion.div
              ref={browseSheetRef}
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto w-full bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:w-[min(36rem,calc(100vw-2rem))] md:max-h-full"
            >
              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 id="tutorial-browse-wishlists" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Browse Wishlists
                </h2>
                <button
                  onClick={() => !isTutorialRunning && setShowBrowseSheet(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close browse menu"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Sheet content */}
              <div className="overflow-y-auto px-4 py-3 pb-6 flex-1">
                <div className="space-y-2">
                  {unifiedBrowseList.map((item, index) => {
                  const isSelected = item.type === 'member'
                    ? viewingMember?.id === item.data.id && !selectedSharedWishlist
                    : selectedSharedWishlist?.id === item.data.id;
                  const householdNames = item.type === 'member'
                    ? getMemberHouseholdNames(item.data)
                    : getSharedWishlistHouseholdNames(item.data);
                  const helperLabel = householdNames.length === 1
                    ? 'In household:'
                    : 'In households:';

                  return (
                    <button
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 mt-0.5 ${
                          item.type === 'member'
                            ? (isSelected ? 'bg-white/20' : getMemberColor(index))
                            : (isSelected ? 'bg-white/20' : 'bg-gradient-to-r from-fuchsia-500 to-pink-500')
                        }`}>
                          {item.type === 'member' ? item.name.charAt(0).toUpperCase() : <Users size={18} />}
                        </div>

                        {/* Name and count */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {item.type === 'shared' && (
                                  <Users size={14} className={`shrink-0 ${isSelected ? 'text-white/80' : 'text-fuchsia-500'}`} />
                                )}
                                <span className="font-medium truncate">{item.name}</span>
                              </div>
                              <span className={`text-sm ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                            {householdNames.length > 0 && (
                              <div className="shrink-0 max-w-[52%] text-right">
                                <div className={`text-[11px] leading-tight ${isSelected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                                  {helperLabel}
                                </div>
                                <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                                  {householdNames.map((householdName) => (
                                    <span
                                      key={`${item.id}-${householdName}`}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] leading-4 ${
                                        isSelected
                                          ? 'bg-white/18 text-white/90'
                                          : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200'
                                      }`}
                                    >
                                      {householdName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={20} className={isSelected ? 'text-white/60' : 'text-gray-400'} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* More Sheet */}
      <AnimatePresence>
        {showMoreSheet && (
          <div
            className="fixed left-0 right-0 top-0 z-50 flex flex-col justify-end md:inset-0 md:items-center md:justify-end pointer-events-none"
            style={{
              bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <motion.div
              ref={moreSheetRef}
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto w-full bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:w-[min(36rem,calc(100vw-2rem))] md:max-h-full"
            >
              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                {moreView !== 'main' ? (
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setMoreView('main');
                    }}
                    className="flex items-center gap-2 -ml-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200"
                    aria-label="Back to More Options"
                  >
                    <ChevronLeft size={20} />
                    <h2 className="text-lg font-semibold">
                      {moreView === 'external' ? 'External Wishlists' : 'Size & Preferences'}
                    </h2>
                  </button>
                ) : (
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    More Options
                  </h2>
                )}
                <button
                  onClick={() => !isTutorialRunning && setShowMoreSheet(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close more menu"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Sheet content - swap between main More menu and sub-views */}
              <div className="relative flex-1 overflow-hidden" style={{ maxHeight: 'calc(70vh - 4rem)' }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {moreView === 'main' && (
                    <motion.div
                      key="more-main"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-y-auto px-4 py-3 space-y-2 pb-6 h-full"
                    >
                {/* External Wishlists */}
                {(viewingMember ? (isOwnWishlist || viewingMember.external_wishlist_count > 0) : (selectedSharedWishlist && (isOwnWishlist || selectedSharedWishlist.external_wishlist_count > 0))) && (
                  <button
                    id="tutorial-external-wishlists"
                    onClick={() => {
                      triggerHaptic();
                      setMoreView('external');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white">
                      <Link2 size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-gray-900 dark:text-white">External Wishlists</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Amazon, Etsy, and other sites</p>
                    </div>
                    {((viewingMember?.external_wishlist_count || 0) + (selectedSharedWishlist?.external_wishlist_count || 0)) > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-medium">
                        {viewingMember?.external_wishlist_count || selectedSharedWishlist?.external_wishlist_count || 0}
                      </span>
                    )}
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                )}

                {/* Size & Preferences */}
                {viewingMember && !selectedSharedWishlist && (
                  <button
                    id="tutorial-preferences"
                    onClick={() => {
                      triggerHaptic();
                      setMoreView('preferences');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/30 dark:hover:to-purple-900/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white">
                      <User size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-gray-900 dark:text-white">Size & Preferences</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Clothing sizes, favorites, notes</p>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                )}

                {/* My Shared Wishlists */}
                {ownedSharedWishlists.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 mt-2 space-y-2">
                    <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      My Shared Wishlists
                    </p>
                    {ownedSharedWishlists.map((wishlist) => {
                      const displayName = wishlist.name.replace(/['']s\s+Wishlist$/i, '').replace(/\s+Wishlist$/i, '');
                      const itemCount = wishlist.item_count || wishlist.items?.length || 0;
                      const isCurrentWishlist = selectedSharedWishlist?.id === wishlist.id;

                      return (
                        <button
                          key={`owned-${wishlist.id}`}
                          onClick={() => {
                            triggerHaptic();
                            setShowMoreSheet(false);
                            onSelectSharedWishlist?.(wishlist);
                          }}
                          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
                            isCurrentWishlist
                              ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                            isCurrentWishlist ? 'bg-white/20' : 'bg-gradient-to-r from-fuchsia-500 to-pink-500'
                          }`}>
                            <Users size={18} />
                          </div>
                          <div className="flex-1 text-left">
                            <span className={`font-medium ${isCurrentWishlist ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                              {displayName}
                            </span>
                            <span className={`text-sm block ${isCurrentWishlist ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                    </motion.div>
                  )}
                  {moreView === 'external' && (
                    <motion.div
                      key="more-external"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-y-auto px-4 py-3 pb-6 h-full"
                    >
                      <ExternalWishlistsPanel
                        member={viewingMember}
                        sharedWishlist={selectedSharedWishlist}
                        isActive={moreView === 'external'}
                      />
                    </motion.div>
                  )}
                  {moreView === 'preferences' && viewingMember && (
                    <motion.div
                      key="more-preferences"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-y-auto px-4 py-3 pb-6 h-full"
                    >
                      <UserPreferencesPanel
                        member={viewingMember}
                        isOwner={viewingMember.id === selectedUser?.id || isAdmin}
                        onUpdateSuccess={onPreferencesUpdate || (() => {})}
                        isActive={moreView === 'preferences'}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar */}
      <nav
        id="tutorial-fab-button"
        ref={navRef}
        className="fixed left-0 right-0 bottom-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1 relative">
          {/* Home Tab */}
          <motion.button
            id="tutorial-home-tab"
            onClick={handleHomePress}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative transition-colors duration-300 ${
              isHomeActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            aria-label="Go to my wishlist"
            aria-current={isHomeActive ? 'page' : undefined}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ scale: isHomeActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <Home size={24} strokeWidth={isHomeActive ? 2.5 : 2} />
            </motion.div>
            <span className="text-[10px] font-semibold tracking-tight">Home</span>
            {isHomeActive && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute -bottom-0.5 w-6 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>

          {/* Browse Tab */}
          <motion.button
            id="tutorial-browse-tab"
            onClick={handleBrowsePress}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative transition-colors duration-300 ${
              showBrowseSheet || (!isHomeActive && !showMoreSheet)
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            aria-label="Browse wishlists"
            aria-expanded={showBrowseSheet}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ scale: showBrowseSheet ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <Users size={24} strokeWidth={showBrowseSheet ? 2.5 : 2} />
            </motion.div>
            <span className="text-[10px] font-semibold tracking-tight">Browse</span>
            {(showBrowseSheet || (!isHomeActive && !showMoreSheet)) && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute -bottom-0.5 w-6 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>

          {/* Center Add Button - Raised */}
          <div className="flex-1 flex items-center justify-center -mt-3">
            <motion.button
              id="tutorial-add-item"
              onClick={handleAddPress}
              disabled={!canAddItem}
              whileHover={canAddItem ? { scale: 1.1 } : {}}
              whileTap={canAddItem ? { scale: 0.92 } : {}}
              className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                canAddItem
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500 text-white hover:shadow-xl hover:shadow-indigo-500/25'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              aria-label={canAddItem ? 'Add new item' : 'Cannot add items to this wishlist'}
              aria-disabled={!canAddItem}
            >
              <Plus size={26} strokeWidth={2.5} />
            </motion.button>
          </div>

          {/* Cart Tab */}
          <motion.button
            id="tutorial-shopping-cart"
            onClick={handleCartPress}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative transition-colors duration-300 ${
              isCartOpen
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            aria-label={`Shopping cart${totalCartBadge ? `, ${totalCartBadge} items` : ''}`}
            aria-expanded={isCartOpen}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="relative"
              animate={{ scale: isCartOpen ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <ShoppingCart size={24} strokeWidth={isCartOpen ? 2.5 : 2} />
              {totalCartBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className={`absolute -top-1.5 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full ${
                    hasNotifications ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                >
                  {totalCartBadge > 99 ? '99+' : totalCartBadge}
                </motion.span>
              )}
            </motion.div>
            <span className="text-[10px] font-semibold tracking-tight">Cart</span>
            {isCartOpen && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute -bottom-0.5 w-6 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>

          {/* More Tab */}
          <motion.button
            id="tutorial-more-tab"
            onClick={handleMorePress}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative transition-colors duration-300 ${
              showMoreSheet
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            aria-label="More options"
            aria-expanded={showMoreSheet}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative">
              <motion.div
                animate={{ scale: showMoreSheet ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <MoreHorizontal size={24} strokeWidth={showMoreSheet ? 2.5 : 2} />
              </motion.div>
              {(viewingMember?.external_wishlist_count > 0 || selectedSharedWishlist?.external_wishlist_count > 0) && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full bg-amber-500"
                >
                  {viewingMember?.external_wishlist_count || selectedSharedWishlist?.external_wishlist_count || 0}
                </motion.span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight">More</span>
            {showMoreSheet && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute -bottom-0.5 w-6 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-500 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind the nav */}
      <div
        className="h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-hidden="true"
      />
    </>
  );
};

export default BottomTabNav;
