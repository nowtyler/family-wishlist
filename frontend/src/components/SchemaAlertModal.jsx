import React from 'react';
import { motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';

const SchemaAlertModal = ({ isOpen, onClose }) => {
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full"
      >
        <div className="flex items-center gap-3 text-yellow-500 mb-4">
          <TriangleAlert className="w-6 h-6" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Database Update Required
          </h3>
        </div>
        
        <div className="text-gray-600 dark:text-gray-300 space-y-4">
          <p>
            The database schema has pending changes. Please contact an administrator to run the database migrations.
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
            This may happen after a system update. The database needs to be upgraded to match the latest code changes.
            To prevent data loss, please avoid adding or modifying items until the upgrade is complete.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SchemaAlertModal;
