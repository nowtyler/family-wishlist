import React from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import MigrationManager from './MigrationManager';

const MigrationModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        {/* Improved close button - larger, more accessible */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 z-10"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
        
        <div className="pr-6 mb-6">
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

        <MigrationManager />
      </motion.div>
    </motion.div>
  );
};

export default MigrationModal;
