// frontend/src/components/Navbar.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon, Menu, X, Pencil, Check, X as XIcon, Settings, LogOut, UserPlus, Trash2, AlertOctagon, Database } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getSystemVersion, updateSystemVersion, deleteAllWishlistItems, 
         getFamilyMembers, clearAllWishlists, getAdminAccess } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import MigrationModal from './admin/MigrationModal';

const Navbar = ({ onClearWishlist, viewingMember }) => {
  const { selectedUser, logout, setSelectedUser, setFamilyMembers } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null); // 'all' or 'user'
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);
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

  // Check if we're in development environment
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setIsDevEnvironment(data.environment === 'dev');
      } catch (err) {
        console.error('Failed to check environment:', err);
      }
    };
    
    checkEnvironment();
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
      setIsEditingVersion(false); // Hide form immediately for better UX
      console.log('Updating version to:', newVersion);
      console.log('Current user:', selectedUser);
      
      // If user is admin by name but ID might be invalid, try getting proper admin access
      if (selectedUser?.name?.toLowerCase() === 'admin' && 
          (!selectedUser.id || selectedUser.id < 1)) {
        try {
          console.log('Getting proper admin access first');
          const adminData = await getAdminAccess();
          setSelectedUser(adminData);
        } catch (adminErr) {
          console.error('Failed to get admin access:', adminErr);
          // Continue anyway with current user
        }
      }
      
      const response = await updateSystemVersion(newVersion);
      if (response && response.data) {
        setVersion(response.data.version);
        console.log('Version updated successfully');
      } else {
        console.error('Invalid response from server:', response);
        alert('Failed to update version: Invalid server response');
        setIsEditingVersion(true); // Re-show form
      }
    } catch (err) {
      console.error('Failed to update version:', err);
      console.error('Response details:', err.response?.data);
      
      // Special handling for admin access issues
      if (err.response?.status === 403 || err.response?.status === 404) {
        try {
          console.log('Attempting to get proper admin access');
          const adminData = await getAdminAccess();
          setSelectedUser(adminData);
          alert("Admin access refreshed. Please try updating the version again.");
        } catch (adminErr) {
          console.error('Failed to get admin access:', adminErr);
          alert(`Failed to update version: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
        }
      } else {
        alert(`Failed to update version: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
      
      setIsEditingVersion(true); // Re-show form on error
    }
  };

  const handleDeleteAll = async () => {
    try {
      if (deleteMode === 'all' && isAdmin) {
        await clearAllWishlists();
      } else {
        await deleteAllWishlistItems(selectedUser.id);
      }
      // Refresh family members to update count
      const membersResponse = await getFamilyMembers();
      setFamilyMembers(membersResponse.data);
      if (onClearWishlist) {
        await onClearWishlist();
      }
      setShowDeleteConfirm(false);
      setShowSettings(false);
      setDeleteMode(null);
    } catch (err) {
      console.error("Error deleting items:", err);
    }
  };

  // Close migration modal on outside click
  useEffect(() => {
    const handleClickOutsideModal = (event) => {
      if (showMigrationModal && !event.target.closest('.modal-content')) {
        setShowMigrationModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideModal);
    return () => document.removeEventListener('mousedown', handleClickOutsideModal);
  }, [showMigrationModal]);

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Logo, Version, and Development Badge */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Family Wishlist
                </span>
              </h1>
              {/* Version Display */}
              <div className="ml-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                {isEditingVersion && isAdmin ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      className="w-20 px-1 py-0.5 text-xs border rounded"
                    />
                    <button 
                      onClick={handleUpdateVersion} 
                      className="text-green-500 hover:text-green-600"
                      title="Save version"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setIsEditingVersion(false)} 
                      className="text-red-500 hover:text-red-600"
                      title="Cancel"
                    >
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
                        title="Edit version"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </span>
                )}
              </div>
              
              {/* Development Environment Badge */}
              {isDevEnvironment && (
                <div className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs rounded-full">
                  DEV
                </div>
              )}
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
                        setDeleteMode('user');
                        setShowDeleteConfirm(true);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Wishlist
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowMigrationModal(true);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Manage Migrations
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setDeleteMode('all');
                            setShowDeleteConfirm(true);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 border-t border-gray-200 dark:border-gray-600"
                        >
                          <AlertOctagon className="w-4 h-4 mr-2" />
                          Clear All Wishlists
                        </button>
                      </>
                    )}
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

      {/* Modals */}
      <AnimatePresence>
        {showMigrationModal && (
          <MigrationModal 
            isOpen={showMigrationModal}
            onClose={() => setShowMigrationModal(false)}
          />
        )}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-xl font-bold">
                  {deleteMode === 'all' ? 'Delete All Wishlists' : 'Delete All Items'}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {deleteMode === 'all' 
                  ? 'Are you sure you want to delete ALL wishlists for ALL users? This action cannot be undone.'
                  : 'Are you sure you want to delete all items from your wishlist? This action cannot be undone.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteMode(null);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;