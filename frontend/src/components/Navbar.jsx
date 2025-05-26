// frontend/src/components/Navbar.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon, Menu, X, Pencil, Check, X as XIcon, Settings, LogOut, UserPlus, Trash2 } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
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

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          {/* Logo and Version */}
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

          {/* Right side with theme toggle and settings */}
          <div className="flex items-center space-x-4">
            {selectedUser && (
              <span className="text-gray-600 dark:text-gray-300 hidden md:inline-block">
                Viewing as: <strong className="text-gray-800 dark:text-white">{selectedUser.name}</strong>
              </span>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Settings Menu */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50">
                  <button
                    onClick={handleChangeUser}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Change User
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Wishlist
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;