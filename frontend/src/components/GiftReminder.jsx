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
      className="p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg shadow-lg flex items-center space-x-3"
    >
      <Gift size={32} className="flex-shrink-0" />
      <div>
        <p className="font-semibold text-sm">Next Up:</p>
        <p className="text-lg font-bold">{eventName}</p>
        <p className="text-sm">{displayText}</p>
      </div>
    </motion.div>
  );
};

export default GiftReminder;