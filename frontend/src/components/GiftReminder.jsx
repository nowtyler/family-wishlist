// frontend/src/components/GiftReminder.jsx
// import React from 'react';
import { motion } from 'framer-motion';
import { Gift } from 'lucide-react'; // npm install lucide-react

const GiftReminder = ({ eventName, displayText }) => {
  if (!eventName) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 dark:from-pink-800 dark:to-rose-900 text-white shadow-lg flex items-center justify-center space-x-3"
    >
      <Gift size={20} className="flex-shrink-0" />
      <div className="flex items-center gap-2 text-sm">
        <p className="font-semibold">{eventName}</p>
        <p>{displayText}</p>
      </div>
    </motion.div>
  );
};

export default GiftReminder;