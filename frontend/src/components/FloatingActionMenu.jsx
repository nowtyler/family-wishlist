import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Plus, Home, Link2, Users, User } from 'lucide-react';

const FloatingActionMenu = ({
  isOwnWishlist,
  viewingMember,
  onAddItem,
  onReturnHome,
  onOpenExternalWishlists,
  onOpenPreferences = null,
  onBrowseWishlists,
  isHidden = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
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
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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

    // Browse wishlists (always available)
    items.push({
      id: 'browse',
      icon: Users,
      label: 'Browse Wishlists',
      onClick: () => {
        setIsOpen(false);
        onBrowseWishlists?.();
      },
      gradient: 'from-pink-500 to-rose-500 dark:from-pink-400 dark:to-rose-400',
      hoverGradient: 'hover:from-pink-600 hover:to-rose-600 dark:hover:from-pink-500 dark:hover:to-rose-500',
    });

    return items;
  };

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
          {isOpen && (
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
                    className={`relative w-12 h-12 rounded-full bg-gradient-to-r ${item.gradient} ${item.hoverGradient} text-white shadow-lg flex items-center justify-center transition-all duration-200`}
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

        {/* Main FAB Button */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
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
