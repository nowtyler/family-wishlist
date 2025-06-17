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
      className="w-full max-w-md mx-auto mb-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-primary-600 dark:text-primary-400">
          <Calendar className="mr-2" size={20} strokeWidth={2} />
          <h3 className="text-lg font-semibold">Upcoming Events</h3>
        </div>
        
        {upcomingEvents.length > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {upcomingEvents.length} {upcomingEvents.length === 1 ? 'Event' : 'Events'}
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {upcomingEvents.slice(0, 4).map((event, index) => {
          // Determine if this is Christmas
          const isChristmas = event.name === "Christmas";
          
          return (
            <motion.div
              key={`${event.name}-${index}`}
              variants={eventVariants}
              className={`flex items-center p-3 rounded-xl transition-all
                ${index === 0 
                  ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 shadow-sm border border-pink-100 dark:border-pink-800/30' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 shadow-sm
                ${index === 0
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : isChristmas 
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-300'}`}
              >
                {index === 0 ? (
                  <Gift size={18} />
                ) : isChristmas ? (
                  <Gift size={16} />
                ) : (
                  <span className="text-sm font-bold">{event.date.getDate()}</span>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {event.name}
                  </p>
                  {index === 0 && (
                    <span className="text-xs px-2 py-0.5 bg-pink-500/20 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-medium">
                      Coming Up!
                    </span>
                  )}
                </div>
                
                <div className="flex items-center mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${index === 0 ? 'animate-pulse bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getCountdownDisplay(event.daysUntil, event.date)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {upcomingEvents.length > 4 && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            + {upcomingEvents.length - 4} more upcoming events
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default UpcomingEventsDisplay;
