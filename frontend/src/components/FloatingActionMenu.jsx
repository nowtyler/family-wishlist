import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Plus, Home, Link2, Users, User, ChevronLeft } from 'lucide-react';

const FloatingActionMenu = ({
  isOwnWishlist,
  viewingMember,
  onAddItem,
  onReturnHome,
  onOpenExternalWishlists,
  onOpenPreferences = null,
  onSelectMember,
  familyMembers = [],
  selectedUser = null,
  isHidden = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMemberSubmenu, setShowMemberSubmenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowMemberSubmenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (showMemberSubmenu) {
          setShowMemberSubmenu(false);
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMemberSubmenu]);

  // Build menu items based on context
  const getMenuItems = () => {
    const items = [];

    if (isOwnWishlist) {
      // Own wishlist context
      items.push({
        id: 'add',
        icon: Plus,
        label: 'Add Item',
        onClick: () => {
          setIsOpen(false);
          onAddItem?.();
        },
        gradient: 'from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400',
        hoverGradient: 'hover:from-sky-600 hover:to-indigo-600 dark:hover:from-sky-500 dark:hover:to-indigo-500',
      });
    } else {
      // Shopping mode context
      items.push({
        id: 'home',
        icon: Home,
        label: 'My Wishlist',
        onClick: () => {
          setIsOpen(false);
          onReturnHome?.();
        },
        gradient: 'from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400',
        hoverGradient: 'hover:from-emerald-600 hover:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500',
      });
    }

    // External wishlists (always available when member has them or viewing own)
    if (viewingMember && (isOwnWishlist || viewingMember.external_wishlist_count > 0)) {
      items.push({
        id: 'external',
        icon: Link2,
        label: 'External Wishlists',
        badge: viewingMember.external_wishlist_count > 0 ? viewingMember.external_wishlist_count : null,
        onClick: () => {
          setIsOpen(false);
          onOpenExternalWishlists?.();
        },
        gradient: 'from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400',
        hoverGradient: 'hover:from-amber-600 hover:to-orange-600 dark:hover:from-amber-500 dark:hover:to-orange-500',
      });
    }

    // Preferences (viewable on any wishlist, editable only on your own)
    if (onOpenPreferences) {
      items.push({
        id: 'preferences',
        icon: User,
        label: 'Size & Preferences',
        onClick: () => {
          setIsOpen(false);
          onOpenPreferences();
        },
        gradient: 'from-violet-500 to-purple-500 dark:from-violet-400 dark:to-purple-400',
        hoverGradient: 'hover:from-violet-600 hover:to-purple-600 dark:hover:from-violet-500 dark:hover:to-purple-500',
      });
    }

    // Browse wishlists (always available) - opens submenu
    items.push({
      id: 'browse',
      icon: Users,
      label: 'Browse Wishlists',
      onClick: () => {
        setShowMemberSubmenu(true);
      },
      gradient: 'from-pink-500 to-rose-500 dark:from-pink-400 dark:to-rose-400',
      hoverGradient: 'hover:from-pink-600 hover:to-rose-600 dark:hover:from-pink-500 dark:hover:to-rose-500',
    });

    return items;
  };

  // Get non-admin family members for the submenu
  const browsableMembers = familyMembers.filter(m => !m.is_admin);

  // Color palette for member avatars
  const memberColors = [
    { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-400' },
    { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', ring: 'ring-emerald-400' },
    { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', ring: 'ring-purple-400' },
    { bg: 'bg-rose-500', hover: 'hover:bg-rose-600', ring: 'ring-rose-400' },
    { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', ring: 'ring-amber-400' },
    { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', ring: 'ring-cyan-400' },
    { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', ring: 'ring-pink-400' },
    { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', ring: 'ring-indigo-400' },
    { bg: 'bg-teal-500', hover: 'hover:bg-teal-600', ring: 'ring-teal-400' },
    { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', ring: 'ring-orange-400' },
  ];

  // Get color for a member based on their index
  const getMemberColor = (index) => memberColors[index % memberColors.length];

  const menuItems = getMenuItems();

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.02,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 25,
      },
    },
    exit: {
      opacity: 0,
      y: 14,
      scale: 0.9,
      transition: {
        duration: 0.16,
        ease: 'easeOut',
      },
    },
  };

  const labelVariants = {
    hidden: { opacity: 0, x: 10, scale: 0.9 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 25,
      },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  if (isHidden) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Menu Container */}
      <div
        ref={menuRef}
        className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3"
      >
        {/* Action Items */}
        <AnimatePresence mode="popLayout">
          {isOpen && !showMemberSubmenu && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col-reverse items-end gap-3 mb-2"
            >
              {menuItems.map((item) => (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  layout="position"
                  className="flex items-center gap-3"
                >
                  {/* Label */}
                  <motion.span
                    variants={labelVariants}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg shadow-lg whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>

                  {/* Action Button */}
                  <motion.button
                    onClick={item.onClick}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    whileFocus={{ scale: 1.1 }}
                    aria-label={item.label}
                    className={`relative w-12 h-12 rounded-full bg-gradient-to-r ${item.gradient} ${item.hoverGradient} text-white shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900`}
                  >
                    <item.icon size={20} />
                    {/* Badge */}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-xs font-bold text-white bg-red-500 dark:bg-red-400 dark:text-gray-900 rounded-full shadow-md border-2 border-white dark:border-gray-900">
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Member Submenu */}
        <AnimatePresence mode="popLayout">
          {isOpen && showMemberSubmenu && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col-reverse items-end gap-2 mb-2"
            >
              {/* Back button */}
              <motion.div
                variants={itemVariants}
                layout="position"
                className="flex items-center gap-3"
              >
                <motion.span
                  variants={labelVariants}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg shadow-lg whitespace-nowrap"
                >
                  Back
                </motion.span>
                <motion.button
                  onClick={() => setShowMemberSubmenu(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  whileFocus={{ scale: 1.1 }}
                  aria-label="Back to main menu"
                  className="w-10 h-10 rounded-full bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 text-white shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  <ChevronLeft size={18} />
                </motion.button>
              </motion.div>

              {/* Member list */}
              {browsableMembers.map((member, index) => {
                const isCurrentMember = viewingMember?.id === member.id;
                const memberColor = getMemberColor(index);
                const initial = member.name.charAt(0).toUpperCase();

                return (
                  <motion.div
                    key={member.id}
                    variants={itemVariants}
                    layout="position"
                    className="flex items-center gap-3"
                  >
                    {/* Member name label */}
                    <motion.span
                      variants={labelVariants}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg shadow-lg whitespace-nowrap ${
                        isCurrentMember
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {member.name}
                    </motion.span>

                    {/* Select button with initial and badge */}
                    <motion.button
                      onClick={() => {
                        setIsOpen(false);
                        setShowMemberSubmenu(false);
                        onSelectMember?.(member);
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      whileFocus={{ scale: 1.1 }}
                      aria-label={`View ${member.name}'s wishlist`}
                      className={`relative w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 text-white font-semibold text-base ${
                        isCurrentMember
                          ? `${memberColor.bg} ring-2 ring-white dark:ring-gray-900`
                          : `${memberColor.bg} ${memberColor.hover}`
                      }`}
                    >
                      {initial}
                      {/* Item count badge */}
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-xs font-bold text-white bg-gray-700 dark:bg-gray-800 rounded-full shadow-md border-2 border-white dark:border-gray-900">
                        {member.wishlist_item_count}
                      </span>
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          onClick={() => {
            if (isOpen) {
              setShowMemberSubmenu(false);
            }
            setIsOpen(!isOpen);
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          whileFocus={{ scale: 1.05 }}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          className={`relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
            isOpen
              ? 'bg-gray-700 dark:bg-gray-600'
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="fab-close"
                initial={{ opacity: 0, scale: 0.85, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.85, rotate: 90 }}
                transition={{ duration: 0.15 }}
              >
                <X size={24} className="text-white" />
              </motion.span>
            ) : (
              <motion.span
                key="fab-menu"
                initial={{ opacity: 0, scale: 0.85, rotate: 90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.85, rotate: -90 }}
                transition={{ duration: 0.15 }}
              >
                <Menu size={24} className="text-white" />
              </motion.span>
            )}
          </AnimatePresence>
          {/* Badge for external wishlists - only show when menu is closed */}
          {!isOpen && viewingMember?.external_wishlist_count > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-xs font-bold text-white bg-amber-500 dark:bg-amber-400 dark:text-gray-900 rounded-full shadow-md border-2 border-white dark:border-gray-900"
            >
              {viewingMember.external_wishlist_count}
            </motion.span>
          )}
        </motion.button>
      </div>
    </>
  );
};

export default FloatingActionMenu;
