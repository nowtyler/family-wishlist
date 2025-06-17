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
      className="w-full max-w-xl mx-auto mt-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
    >
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center text-primary-600 dark:text-primary-400">
          <Calendar className="mr-2" size={18} strokeWidth={2} />
          <h3 className="text-base font-semibold">Upcoming Events</h3>
        </div>
        
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
      
      <div className="overflow-y-auto max-h-48 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div className="space-y-1">
          {upcomingEvents.map((event, index) => {
            // Determine if this is Christmas
            const isChristmas = event.name === "Christmas";
            
            return (
              <motion.div
                key={`${event.name}-${index}`}
                variants={eventVariants}
                className={`flex items-center py-2 px-3 mb-1 rounded-lg transition-all
                  ${index === 0 
                    ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100/70 dark:border-pink-800/20 shadow-sm' 
                    : isChristmas 
                      ? 'bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-900/10 dark:to-red-900/5 hover:from-red-100/70 dark:hover:from-red-900/20'
                      : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'}`}
              >
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                      {isChristmas ? (
                        <span className="flex items-center">
                          <Gift size={14} className="mr-1.5 text-red-500 dark:text-red-400" />
                          {event.name}
                        </span>
                      ) : (
                        event.name
                      )}
                      {index === 0 && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-pink-500/20 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-medium inline-block">
                          Next
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className={`text-sm font-medium whitespace-nowrap px-2 py-1 rounded ${
                    event.daysUntil === 0 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : event.daysUntil === 1
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : event.daysUntil <= 7 
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                        : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {event.daysUntil === 0 
                      ? 'Today!' 
                      : event.daysUntil === 1 
                        ? 'Tomorrow!' 
                        : `${event.daysUntil} days`}
                  </div>
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
