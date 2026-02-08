// frontend/src/components/Navbar.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Sun, Moon, Menu, X, Pencil, Check, X as XIcon, Settings, LogOut, UserPlus,
         Trash2, AlertOctagon, Database, UserRound, User, Home, Download, Upload, HelpCircle, Baby, Users } from 'lucide-react';
import { useTutorial } from '../contexts/TutorialContext';
import { useTheme } from '../contexts/ThemeContext';
import { getSystemVersion, updateSystemVersion, deleteAllWishlistItems,
         getFamilyMembers, clearAllWishlists, exportWishlist, importWishlist, deleteAllSharedWishlistItems } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import MigrationModal from './admin/MigrationModal';
import FamilyMemberManager from './admin/FamilyMemberManager';
import UserProfileModal from './UserProfileModal';
import UserHouseholdManager from './UserHouseholdManager';

const Navbar = ({
  onClearWishlist = () => {},
  viewingMember = null,
  selectedSharedWishlist = null,
  onHouseholdUpdate = () => {},
  onRefreshWishlist = () => {},
  onOpenSharedWishlists = null
} = {}) => {
  const { selectedUser, logout, setSelectedUser, setFamilyMembers } = useAppContext();
  const { darkMode, toggleDarkMode } = useTheme();
  const tutorial = useTutorial();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null); // 'all', 'user', or 'shared'
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showUserHouseholdManager, setShowUserHouseholdManager] = useState(false);
  const settingsRef = useRef(null);
  const isAdmin = selectedUser?.is_admin;
  const isSharedWishlistOwner = selectedSharedWishlist?.owners?.some(
    (owner) => owner.id === selectedUser?.id
  );
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

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

  // Check if we're in development environment (improved detection)
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        // First check if the environment is set directly in env vars
        if (import.meta.env.IS_DEV_ENV ||
            import.meta.env.ENVIRONMENT === 'development' ||
            import.meta.env.ENVIRONMENT === 'dev') {  // Legacy support
          setIsDevEnvironment(true);
          return;
        }

        // Fallback to checking the API
        const response = await fetch('/api/health');
        const data = await response.json();
        setIsDevEnvironment(data.environment !== 'production' && data.environment !== 'prod');
      } catch (err) {
        console.error('Failed to check environment:', err);
        // Default to checking Vite environment variables as fallback
        setIsDevEnvironment(import.meta.env.DEV === true);
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

  const handleUpdateVersion = async () => {
    try {
      setIsEditingVersion(false); // Hide form immediately for better UX
      console.log('Updating version to:', newVersion);
      console.log('Current user:', selectedUser);
      
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
      
      alert(`Failed to update version: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      
      setIsEditingVersion(true); // Re-show form on error
    }
  };

  const handleDeleteAll = async () => {
    try {
      if (deleteMode === 'all' && isAdmin) {
        await clearAllWishlists();
      } else if (deleteMode === 'shared' && selectedSharedWishlist?.id) {
        await deleteAllSharedWishlistItems(selectedSharedWishlist.id);
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

  // Add this function to handle opening the family member manager
  const handleOpenFamilyManager = () => {
    setShowSettings(false); // Close settings menu
    setShowFamilyManager(true);
  };

  const handleHouseholdUpdateComplete = async () => {
    // Close the modal
    setShowUserHouseholdManager(false);

    // Refresh family members to reflect household changes
    try {
      const response = await getFamilyMembers();
      setFamilyMembers(response.data);

      // Call the callback if provided (for dashboard refresh)
      if (onHouseholdUpdate) {
        await onHouseholdUpdate();
      }

      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (error) {
      console.error('Error refreshing family members after household update:', error);
    }
  };

  // Export wishlist handler
  const handleExport = async () => {
    if (!viewingMember?.id) return;
    try {
      const response = await exportWishlist(viewingMember.id);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wishlist-${new Date().toISOString().split('T')[0]}-${viewingMember.name?.toLowerCase() || 'user'}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export wishlist:', error);
      alert('Failed to export wishlist. Please try again.');
    }
  };

  // Import wishlist handlers
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !viewingMember?.id) return;
    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const { result } = e.target || {};
          if (typeof result !== 'string') {
            throw new Error('Invalid wishlist file');
          }
          const wishlistData = JSON.parse(result);
          const response = await importWishlist(viewingMember.id, wishlistData);
          if (onRefreshWishlist) await onRefreshWishlist();
          const { imported_items, skipped_items } = response.data;
          if (imported_items.length === 0 && skipped_items.length > 0) {
            alert('All items were already in your wishlist. No new items were imported.');
          } else if (skipped_items.length > 0) {
            alert(`Successfully imported ${imported_items.length} items.\n\nSkipped ${skipped_items.length} duplicate items:\n${skipped_items.join('\n')}`);
          } else {
            alert(`Successfully imported ${imported_items.length} items!`);
          }
        } catch (error) {
          console.error('Failed to import wishlist:', error);
          alert('Failed to import wishlist. Please check the file format and try again.');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert('Failed to read file. Please try again.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-300 dark:border-gray-600 sticky top-0 z-50">
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
              <button
                id="tutorial-theme-toggle"
                onClick={toggleDarkMode}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                aria-label="Toggle theme"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Settings Menu */}
              <div className="relative" ref={settingsRef}>
                <button
                  id="tutorial-settings"
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                  aria-label="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Settings Dropdown */}
                {showSettings && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50">
                    {/* User Info Section */}
                    {selectedUser && (
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {selectedUser.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {selectedUser.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              @{selectedUser.username || 'legacy'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Import/Export Buttons for own wishlist only */}
                    {viewingMember && selectedUser && viewingMember.id === selectedUser.id && (
                      <>
                        <button
                          onClick={handleExport}
                          className="flex items-center w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Wishlist
                        </button>
                        <button
                          onClick={handleImportClick}
                          disabled={isImporting}
                          className="flex items-center w-full px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isImporting ? 'Importing...' : 'Import Wishlist'}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </>
                    )}
                    
                    {/* User Profile Management for non-admin users */}
                    {!isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowUserProfileModal(true);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <User className="w-4 h-4 mr-2" />
                          Edit Profile
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            setShowUserHouseholdManager(true);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Home className="w-4 h-4 mr-2" />
                          Manage Households
                        </button>
                      </>
                    )}
                    
                    {/* Admin Management for admin users */}
                    {isAdmin && (
                      <button
                        onClick={handleOpenFamilyManager}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <UserRound className="w-4 h-4 mr-2" />
                        <span>Manage Users</span>
                      </button>
                    )}

                    {/* Manage Shared Wishlists - available to everyone */}
                    {onOpenSharedWishlists && (
                      <button
                        onClick={() => {
                          setShowSettings(false);
                          onOpenSharedWishlists();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <Users className="w-4 h-4 mr-2 text-fuchsia-500" />
                        <span>Manage Shared Wishlists</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setDeleteMode(isSharedWishlistOwner ? 'shared' : 'user');
                        setShowDeleteConfirm(true);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isSharedWishlistOwner ? 'Clear Shared Wishlist' : 'Clear Wishlist'}
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
                      </>
                    )}
                    {/* Tutorial Button */}
                    {tutorial && (
                      <button
                        onClick={() => {
                          setShowSettings(false);
                          // If viewing someone else's wishlist, navigate to own wishlist first
                          if (viewingMember && selectedUser && viewingMember.id !== selectedUser.id) {
                            navigate('/');
                            // Start tutorial after navigation completes
                            setTimeout(() => tutorial.startTutorial(), 300);
                          } else {
                            tutorial.startTutorial();
                          }
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <HelpCircle className="w-4 h-4 mr-2" />
                        App Tutorial
                      </button>
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

          {/* Wishlist Header - Second row blended into navbar */}
          {(viewingMember || selectedSharedWishlist) && selectedUser && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
              <div className="flex flex-col items-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white drop-shadow-lg text-center">
                  {selectedSharedWishlist
                    ? selectedSharedWishlist.name
                    : (viewingMember.id === selectedUser.id ? "Your Wishlist" : `${viewingMember.name || ''}'s Wishlist`)}
                </h2>
                <div className="hidden sm:flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
                  {selectedSharedWishlist ? (
                    <span>
                      Owned by {selectedSharedWishlist.owners?.map((owner, index) => {
                        const isLast = index === selectedSharedWishlist.owners.length - 1;
                        const isSecondToLast = index === selectedSharedWishlist.owners.length - 2;
                        return (
                          <span key={owner.id}>
                            {owner.name}
                            {!isLast && (isSecondToLast ? ' and ' : ', ')}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span>{(viewingMember.id === selectedUser.id ? "Manage your wishes or " : "Browse wishes and ") + "see what others are hoping for!"}</span>
                  )}
                </div>
              </div>
            </div>
          )}
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
                  {deleteMode === 'all'
                    ? 'Delete All Wishlists'
                    : deleteMode === 'shared'
                      ? 'Clear Shared Wishlist'
                      : 'Delete All Items'}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {deleteMode === 'all'
                  ? 'Are you sure you want to delete ALL wishlists for ALL users? This action cannot be undone.'
                  : deleteMode === 'shared'
                    ? 'Are you sure you want to clear all items from this shared wishlist? This action cannot be undone.'
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
        {/* Family Member Manager Modal */}
        {showFamilyManager && (
          <FamilyMemberManager
            isOpen={showFamilyManager}
            onClose={() => setShowFamilyManager(false)}
          />
        )}
        {/* User Profile Modal */}
        {showUserProfileModal && (
          <UserProfileModal
            isOpen={showUserProfileModal}
            onClose={() => setShowUserProfileModal(false)}
          />
        )}
        
        {/* User Household Manager Modal */}
        {showUserHouseholdManager && (
          <UserHouseholdManager
            isOpen={showUserHouseholdManager}
            onClose={() => setShowUserHouseholdManager(false)}
            onComplete={handleHouseholdUpdateComplete}
            title="Manage Your Households"
            subtitle="Join existing households, create new ones, or leave households you're in"
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
