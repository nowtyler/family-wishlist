import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import MigrationManager from './MigrationManager';

const MigrationModal = ({ isOpen, onClose }) => {
  // Add state to control when the modal can be closed
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

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
    
    if (!isProcessing) {
      onClose();
    }
  };

  // Cancel background click propagation
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  // Function to create backup
  const handleCreateBackup = async () => {
    try {
      setIsCreatingBackup(true);
      setProcessingStatus(true);
      
      // Import the createBackup function directly here to avoid passing it through props
      const { createBackup } = await import('../../services/api');
      
      await createBackup();
      alert("Backup created successfully!");
      
      // Refresh the backups list in MigrationManager
      if (window.refreshBackups) {
        await window.refreshBackups();
      }
    } catch (err) {
      console.error('Failed to create backup:', err);
      alert("Failed to create backup: " + (err.response?.data?.detail || err.message || 'Unknown error'));
    } finally {
      setIsCreatingBackup(false);
      setProcessingStatus(false);
    }
  };

  // Add a global click handler to detect clicks outside inner modal elements
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e) => {
      // Only check if we're trying to close the modal with outside clicks
      if (isProcessing || !e.target.classList.contains('modal-backdrop')) return;
      handleClose();
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [isOpen, isProcessing]);

  if (!isOpen) return null;

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
        onClick={handleContentClick}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative modal-content"
      >
        {/* Remove the X button from the top */}
        
        <div className="mb-6">
          <div className="flex items-start gap-2 mb-1">
            <AlertTriangle className="text-yellow-500 mt-1" size={20} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Database Migration Manager
            </h2>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400 ml-7 mt-2">
            <p className="mb-2">Warning: Database migrations can potentially modify your data structure.</p>
            <p>Make sure you have a backup before proceeding with any migration.</p>
          </div>
        </div>

        {/* Pass the setProcessingStatus to MigrationManager */}
        <MigrationManager 
          setProcessingStatus={setProcessingStatus} 
        />
        
        {/* Add sticky close button at the bottom */}
        <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
          <div className="flex gap-3">
            {/* Add Create Backup button alongside Close button */}
            <button
              onClick={handleCreateBackup}
              disabled={isProcessing || isCreatingBackup}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 
                bg-gradient-to-r from-blue-500 to-indigo-600 
                hover:from-blue-600 hover:to-indigo-700
                text-white rounded-lg shadow-sm
                transition-all duration-300
                ${(isProcessing || isCreatingBackup) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCreatingBackup ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
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
            </button>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className={`py-2.5 px-4 w-28
                bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 
                text-gray-800 dark:text-gray-200 
                font-medium rounded-lg transition-colors duration-200 
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'dark:hover:bg-gray-600'}`}
              aria-label="Close modal"
            >
              {isProcessing ? 'Processing...' : 'Close'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MigrationModal;
