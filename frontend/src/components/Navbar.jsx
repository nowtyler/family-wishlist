// frontend/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Navbar = () => {
  const { selectedUser, logout, setSelectedUser } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/auth');
  };

  const handleChangeUser = () => {
    setSelectedUser(null);
    setIsMenuOpen(false);
    navigate('/select-user');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          {/* Logo/Title - always visible */}
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Family Wishlist
            </span>
          </h1>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {selectedUser && (
              <span className="text-gray-600 dark:text-gray-300">
                Viewing as: <strong className="text-gray-800 dark:text-white">{selectedUser.name}</strong>
              </span>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={handleChangeUser}
              className="px-3 py-1 text-sm text-primary border border-primary rounded hover:bg-primary hover:text-white dark:text-primary-300 dark:border-primary-300 dark:hover:bg-primary-800 transition-colors"
            >
              Change User
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm text-red-500 dark:text-red-400 border border-red-500 dark:border-red-400 rounded hover:bg-red-500 hover:text-white dark:hover:bg-red-900 transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mr-2"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            {selectedUser && (
              <div className="text-gray-600 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-700">
                Viewing as: <strong className="text-gray-800 dark:text-white">{selectedUser.name}</strong>
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleChangeUser}
                className="w-full px-3 py-2 text-sm text-primary border border-primary rounded hover:bg-primary hover:text-white dark:text-primary-300 dark:border-primary-300 dark:hover:bg-primary-800 transition-colors"
              >
                Change User
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-sm text-red-500 dark:text-red-400 border border-red-500 dark:border-red-400 rounded hover:bg-red-500 hover:text-white dark:hover:bg-red-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;