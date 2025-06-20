import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Gift, User, Menu, X, Sun, Moon, LogOut } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

const MobileNavToolbar = ({ onViewOwnWishlist, onBrowseWishlists }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { selectedUser, logout } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleViewOwnWishlist = () => {
    setIsMenuOpen(false);
    if (onViewOwnWishlist) onViewOwnWishlist();
  };

  const handleBrowseWishlists = () => {
    setIsMenuOpen(false);
    if (onBrowseWishlists) onBrowseWishlists();
  };

  return (
    <>
      {/* Mobile Navigation Toolbar - Fixed at bottom of screen on small devices */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 z-40">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={handleViewOwnWishlist}
            className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary-400 p-2"
          >
            <Home size={22} />
            <span className="text-xs mt-1">My List</span>
          </button>
          
          <button
            onClick={handleBrowseWishlists}
            className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary-400 p-2"
          >
            <Gift size={22} />
            <span className="text-xs mt-1">Browse</span>
          </button>
          
          <button
            onClick={toggleMenu}
            className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary-400 p-2"
          >
            {isMenuOpen ? (
              <X size={22} />
            ) : (
              <Menu size={22} />
            )}
            <span className="text-xs mt-1">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="md:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 z-30"
          >
            <div className="p-4 space-y-4">
              {/* User Info */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {selectedUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {selectedUser?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    @{selectedUser?.username || 'legacy'}
                  </div>
                </div>
              </div>
              
              {/* Theme Toggle */}
              <button
                onClick={toggleDarkMode}
                className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {darkMode ? (
                  <>
                    <Sun className="text-amber-500" />
                    <span className="text-gray-700 dark:text-gray-200">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="text-blue-500" />
                    <span className="text-gray-700 dark:text-gray-200">Dark Mode</span>
                  </>
                )}
              </button>
              
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full p-3 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="text-red-500" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/50 z-20"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNavToolbar;
