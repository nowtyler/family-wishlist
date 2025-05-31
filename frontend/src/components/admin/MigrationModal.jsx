import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import MigrationManager from './MigrationManager';

const MigrationModal = ({ isOpen, onClose }) => {
  // Add state to control when the modal can be closed
  const [isProcessing, setIsProcessing] = useState(false);

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
        <MigrationManager setProcessingStatus={setProcessingStatus} />
        
        {/* Add sticky close button at the bottom */}
        <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className={`w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200 ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'dark:hover:bg-gray-600'
            }`}
            aria-label="Close modal"
          >
            {isProcessing ? 'Processing...' : 'Close'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MigrationModal;
