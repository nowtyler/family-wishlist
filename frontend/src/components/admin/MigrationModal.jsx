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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Database Migration Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <p className="mb-2">⚠️ Warning: Database migrations can potentially modify your data structure.</p>
          <p>Make sure you have a backup before proceeding with any migration.</p>
        </div>

        <MigrationManager />
      </motion.div>
    </motion.div>
  );
};

export default MigrationModal;
