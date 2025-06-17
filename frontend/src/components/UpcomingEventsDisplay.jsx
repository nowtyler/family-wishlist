// frontend/src/components/UpcomingEventsDisplay.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Gift } from 'lucide-react';
import { getCountdownDisplay, getUpcomingEvents } from '../utils/dateUtils';

const UpcomingEventsDisplay = ({ familyMembers }) => {
  // Get and sort all upcoming events
  const upcomingEvents = useMemo(() => {
    return getUpcomingEvents(familyMembers);
  }, [familyMembers]);
  
  if (!upcomingEvents || upcomingEvents.length === 0) return null;

  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  // Event item animation
  const eventVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-xl mx-auto mt-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center text-primary-600 dark:text-primary-400">
          <Calendar className="mr-2" size={18} strokeWidth={2} />
          <h3 className="text-base font-semibold">Upcoming Events</h3>
        </div>
      </div>
      
      <div className="overflow-y-auto max-h-40 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div className="space-y-1">
          {upcomingEvents.map((event, index) => {
            // Determine if this is Christmas
            const isChristmas = event.name === "Christmas";
            
            return (
              <motion.div
                key={`${event.name}-${index}`}
                variants={eventVariants}
                className={`flex items-center py-1.5 px-2 rounded-lg transition-all
                  ${index === 0 
                    ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100/70 dark:border-pink-800/20' 
                    : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                      {event.name}
                      {index === 0 && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-pink-500/20 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-medium inline-block">
                          Next
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getCountdownDisplay(event.daysUntil, event.date)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default UpcomingEventsDisplay;
