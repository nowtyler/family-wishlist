// frontend/src/components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon, Menu, X, Pencil, Check, X as XIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getSystemVersion, updateSystemVersion } from '../services/api';

const Navbar = () => {
  const { selectedUser, logout, setSelectedUser } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const response = await getSystemVersion();
        setVersion(response.data.version);
      } catch (err) {
        console.error('Failed to load version:', err);
      }
    };
    loadVersion();
  }, []);

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

  const handleUpdateVersion = async () => {
    try {
      const response = await updateSystemVersion(newVersion);
      setVersion(response.data.version);
      setIsEditingVersion(false);
    } catch (err) {
      console.error('Failed to update version:', err);
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Family Wishlist
              </span>
            </h1>
            <div className="ml-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              {isEditingVersion && isAdmin ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    className="w-20 px-1 py-0.5 text-xs border rounded"
                  />
                  <button onClick={handleUpdateVersion} className="text-green-500 hover:text-green-600">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingVersion(false)} className="text-red-500 hover:text-red-600">
                    <XIcon size={14} />
                  </button>
                </div>
              ) : (
                <span className="flex items-center">
                  v{version}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setNewVersion(version);
                        setIsEditingVersion(true);
                      }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>

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