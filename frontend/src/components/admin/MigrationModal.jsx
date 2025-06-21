import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert, Check, RotateCcw, Trash2, Loader, X, CircleAlert } from 'lucide-react';
import MigrationManager from './MigrationManager';

const MigrationModal = ({ isOpen, onClose }) => {
  // Add state to control when the modal can be closed
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupError, setBackupError] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  
  // Backup action states
  const [actionType, setActionType] = useState(null); // 'restore' or 'delete'
  const [actionConfirm, setActionConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null); // 'success' or 'failure'

  // This function will be passed to the MigrationManager
  const setProcessingStatus = useCallback((status) => {
    setIsProcessing(status);
  }, []);

  // Prevent closing while processing
  const handleClose = (e) => {
    // Stop event propagation to prevent multiple close events
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!isProcessing && !isCreatingBackup && !actionLoading) {
      onClose();
    }
  };

  // Cancel background click propagation
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  // Action handler for restore/delete - Fixed to properly handle first click
  const handleActionClick = async (type) => {
    if (!selectedBackup) return;
    
    // If action is already in progress or showing result, do nothing
    if (actionLoading || actionResult) return;
    
    // If confirmation is already showing for this action type, execute it
    if (actionType === type && actionConfirm) {
      await executeAction();
      return;
    }
    
    // Otherwise show confirmation for this action type
    setActionType(type);
    setActionConfirm(true);
  };
  
  // Execute the selected action
  const executeAction = async () => {
    if (!selectedBackup || !actionType) return;
    
    try {
      setActionLoading(true);
      setProcessingStatus(true);
      
      // Import functions dynamically
      const { restoreBackup, deleteBackup } = await import('../../services/api');
      
      if (actionType === 'restore') {
        const response = await restoreBackup(selectedBackup.filename);
        if (!response.data.success) {
          throw new Error(response.data.message || 'Restore failed');
        }
      } else if (actionType === 'delete') {
        await deleteBackup(selectedBackup.filename);
      }
      
      setActionResult('success');
      
      // Refresh backups list
      if (window.refreshBackups) {
        await window.refreshBackups();
      }
      
      // Auto-dismiss success after 2 seconds
      const timer = setTimeout(() => {
        resetActionStates();
      }, 2000);
      
      // Store timer reference to clean up if component unmounts
      return () => clearTimeout(timer);
    } catch (err) {
      console.error(`Failed to ${actionType}:`, err);
      setActionResult('failure');
      
      // Don't reset after failure - user must manually dismiss
    } finally {
      setActionLoading(false);
      setProcessingStatus(false);
    }
  };
  
  // Function to create backup
  const handleCreateBackup = async () => {
    if (isCreatingBackup || backupSuccess) return;
    
    try {
      setIsCreatingBackup(true);
      setProcessingStatus(true);
      setBackupSuccess(false);
      setBackupError(false);
      
      // Import the createBackup function directly here to avoid passing it through props
      const { createBackup } = await import('../../services/api');
      
      await createBackup();
      
      // Show success state instead of alert
      setBackupSuccess(true);
      
      // Refresh the backups list in MigrationManager
      if (window.refreshBackups) {
        await window.refreshBackups();
      }
      
      // Reset to normal state after 2 seconds instead of 5
      setTimeout(() => {
        setBackupSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed:', err);
      // Show error feedback in the button itself
      setBackupSuccess(false);
      setBackupError(true); // Add this new state for backup errors
      
      // Don't auto-reset on failure
    } finally {
      setIsCreatingBackup(false);
      setProcessingStatus(false);
    }
  };

  // Reset all action states - add optional parameters for selective reset
  const resetActionStates = (keepSelection = false) => {
    setActionType(null);
    setActionConfirm(false);
    setActionLoading(false);
    setActionResult(null);
    setBackupError(false);
    
    if (!keepSelection) {
      setSelectedBackup(null);
    }
  };
  
  // Handle escape key or closing when action is in progress
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (actionType && !actionLoading) {
          resetActionStates();
          e.preventDefault(); // Prevent modal from closing
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [actionType, actionLoading]);

  if (!isOpen) return null;

  // Get button styles and text based on current state
  const getBackupButtonStyles = () => {
    if (isCreatingBackup) {
      return "bg-blue-500 hover:bg-blue-500";
    } else if (backupSuccess) {
      return "bg-green-500 hover:bg-green-500";
    } else if (backupError) {
      return "bg-orange-500 hover:bg-orange-600";
    } else {
      return "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700";
    }
  };
  
  // Get action button styles
  const getActionButtonStyles = (type) => {
    if (actionLoading) {
      return "bg-gray-500";
    }
    
    if (actionResult === 'success') {
      return "bg-green-500";
    }
    
    if (actionResult === 'failure') {
      return "bg-orange-500";
    }
    
    if (type === 'restore') {
      return actionConfirm && actionType === 'restore'
        ? "bg-blue-600 hover:bg-blue-700" 
        : "bg-blue-500 hover:bg-blue-600";
    }
    
    if (type === 'delete') {
      return actionConfirm && actionType === 'delete'
        ? "bg-red-600 hover:bg-red-700"
        : "bg-red-500 hover:bg-red-600";
    }
    
    return "bg-gray-500";
  };

  // Get text for the button based on state
  const getActionButtonText = (type) => {
    if (actionLoading && actionType === type) {
      return "Processing...";
    }
    
    if (actionResult === 'success' && actionType === type) {
      return "Success!";
    }
    
    if (actionResult === 'failure' && actionType === type) {
      return "Failed!";
    }
    
    if (actionConfirm && actionType === type) {
      return "Confirm?";
    }
    
    return type === 'restore' ? "Restore" : "Delete";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-backdrop"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative modal-content"
      >
        <div className="mb-6">
          <div className="flex items-start gap-2 mb-1">
            <TriangleAlert className="text-yellow-500 mt-1" size={20} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Database Migration Manager
            </h2>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400 ml-7 mt-2">
            <p className="mb-2">Warning: Database migrations can potentially modify your data structure.</p>
            <p>Make sure you have a backup before proceeding with any migration.</p>
          </div>
        </div>

        {/* Pass the setProcessingStatus and selected backup to MigrationManager */}
        <MigrationManager 
          setProcessingStatus={setProcessingStatus}
          selectedBackup={selectedBackup}
          setSelectedBackup={setSelectedBackup}
        />
        
        {/* Add sticky close button at the bottom */}
        <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
          <div className="flex gap-3">
            {/* Conditional rendering of buttons based on selection state */}
            <AnimatePresence mode="wait">
              {selectedBackup ? (
                <motion.div 
                  key="action-buttons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex-1 flex gap-2"
                >
                  {/* Show different layouts depending on action state */}
                  {actionResult ? (
                    // Success or Failure state - show only the relevant button at full width
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                        ${actionResult === 'success' ? 'bg-green-500' : 'bg-orange-500'} 
                        text-white rounded-lg shadow-sm transition-all duration-300`}
                      onClick={() => actionResult === 'success' ? resetActionStates() : resetActionStates(true)}
                    >
                      {actionResult === 'success' ? (
                        <>
                          <Check size={18} />
                          <span>{actionType === 'restore' ? 'Restored Successfully!' : 'Deleted Successfully!'}</span>
                        </>
                      ) : (
                        <>
                          <CircleAlert size={18} />
                          <span>Operation Failed - Click to dismiss</span>
                        </>
                      )}
                    </button>
                  ) : actionLoading ? (
                    // Loading state - show only the loading button at full width
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                        bg-blue-500 text-white rounded-lg shadow-sm"
                    >
                      <Loader size={18} className="animate-spin" />
                      <span>Processing {actionType}...</span>
                    </button>
                  ) : (
                    // Normal state with both buttons
                    <>
                      {/* Restore Button */}
                      <button
                        onClick={() => handleActionClick('restore')}
                        disabled={actionLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                          ${actionConfirm && actionType === 'restore' 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-blue-500 hover:bg-blue-600'} 
                          text-white rounded-lg shadow-sm transition-all duration-300`}
                      >
                        <RotateCcw size={18} />
                        <span>{actionConfirm && actionType === 'restore' ? "Confirm?" : "Restore"}</span>
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleActionClick('delete')}
                        disabled={actionLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                          ${actionConfirm && actionType === 'delete' 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-red-500 hover:bg-red-600'}
                          text-white rounded-lg shadow-sm transition-all duration-300`}
                      >
                        <Trash2 size={18} />
                        <span>{actionConfirm && actionType === 'delete' ? "Confirm?" : "Delete"}</span>
                      </button>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.button
                  key="create-backup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={handleCreateBackup}
                  disabled={isProcessing}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                    ${getBackupButtonStyles()}
                    text-white rounded-lg shadow-sm
                    transition-all duration-300
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCreatingBackup ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Backup...
                    </span>
                  ) : backupSuccess ? (
                    <span className="flex items-center gap-2">
                      <Check size={18} className="text-white" />
                      <span className="font-medium">Backup Created!</span>
                    </span>
                  ) : backupError ? (
                    <span className="flex items-center gap-2" onClick={() => setBackupError(false)}>
                      <CircleAlert size={18} className="text-white" />
                      <span className="font-medium">Backup Failed - Try Again</span>
                    </span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span className="font-medium">Create Backup</span>
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Transform the Close button to a Cancel button when action is selected */}
            <AnimatePresence mode="wait">
              {/* When an action is being confirmed, show X button */}
              {(actionConfirm && !actionLoading && !actionResult) ? (
                <motion.button
                  key="cancel-button"
                  initial={{ opacity: 0, width: '7rem' }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: '7rem' }}
                  onClick={() => resetActionStates()}
                  className="py-2.5 px-4 w-12 h-[42px] flex items-center justify-center
                    bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 
                    text-gray-800 dark:text-gray-200 
                    font-medium rounded-lg transition-all duration-200"
                  aria-label="Cancel"
                >
                  <X size={20} />
                </motion.button>
              ) : (
                /* Otherwise show normal Close button */
                <motion.button
                  key="close-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleClose}
                  disabled={isProcessing || isCreatingBackup || actionLoading}
                  className={`py-2.5 px-4 w-28 h-[42px] flex items-center justify-center
                    bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 
                    text-gray-800 dark:text-gray-200 
                    font-medium rounded-lg transition-colors duration-200 
                    ${(isProcessing || isCreatingBackup || actionLoading) ? 'opacity-50 cursor-not-allowed' : 'dark:hover:bg-gray-600'}`}
                  aria-label="Close modal"
                >
                  Close
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MigrationModal;
