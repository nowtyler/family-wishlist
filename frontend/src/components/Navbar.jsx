// frontend/src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Navbar = () => {
  const { selectedUser, logout, setSelectedUser } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleChangeUser = () => {
    setSelectedUser(null); // Clear selected user, will redirect to user selection
    navigate('/select-user');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Family Wishlist
          </span>
        </h1>
        <div className="flex items-center space-x-4">
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
      </div>
    </nav>
  );
};

export default Navbar;