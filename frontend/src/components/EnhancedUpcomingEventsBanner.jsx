import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { getCountdownDisplay, getUpcomingEvents } from '../utils/dateUtils';

const EnhancedUpcomingEventsBanner = ({ familyMembers }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get and sort all upcoming events
  const upcomingEvents = useMemo(() => {
    return getUpcomingEvents(familyMembers);
  }, [familyMembers]);
  
  if (!upcomingEvents || upcomingEvents.length === 0) return null;

  // Get the most recent upcoming event (first in the sorted list)
  const nextEvent = upcomingEvents[0];
  const isChristmas = nextEvent.name === "Christmas";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mb-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* Main Banner - Always Visible */}
      <div 
        className={`p-4 cursor-pointer transition-all duration-200 ${
          isChristmas 
            ? 'bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-900/10 dark:to-red-900/5 hover:from-red-100/70 dark:hover:from-red-900/20'
            : 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 hover:from-pink-100/70 dark:hover:from-pink-900/30'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isChristmas 
                ? 'bg-red-100 dark:bg-red-900/30' 
                : 'bg-pink-100 dark:bg-pink-900/30'
            }`}>
              {isChristmas ? (
                <Gift className="w-5 h-5 text-red-500 dark:text-red-400" />
              ) : (
                <Calendar className="w-5 h-5 text-pink-500 dark:text-pink-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {nextEvent.name}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-pink-500/20 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-medium">
                  Next
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isChristmas ? 'Dec 25' : nextEvent.date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              nextEvent.daysUntil === 0 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : nextEvent.daysUntil === 1
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : nextEvent.daysUntil <= 7 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {nextEvent.daysUntil === 0 
                ? 'Today!' 
                : nextEvent.daysUntil === 1 
                  ? 'Tomorrow!' 
                  : `${nextEvent.daysUntil} days`}
            </div>
            
            <button className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Events List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 dark:border-gray-700"
          >
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center text-primary-600 dark:text-primary-400">
                  <Calendar className="mr-2" size={16} strokeWidth={2} />
                  <h4 className="text-sm font-semibold">All Upcoming Events</h4>
                </div>
                
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {upcomingEvents.map((event, index) => {
                  const isEventChristmas = event.name === "Christmas";
                  
                  return (
                    <div
                      key={`${event.name}-${index}`}
                      className={`flex items-center py-2 px-3 rounded-lg transition-all
                        ${index === 0 
                          ? 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100/70 dark:border-pink-800/20 shadow-sm' 
                          : isEventChristmas 
                            ? 'bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-900/10 dark:to-red-900/5 hover:from-red-100/70 dark:hover:from-red-900/20'
                            : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'}`}
                    >
                      <div className="flex-1 flex justify-between items-center gap-2">
                        <div className="flex items-center flex-wrap pr-1">
                          {isEventChristmas && <Gift size={14} className="mr-1.5 flex-shrink-0 text-red-500 dark:text-red-400" />}
                          
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                              {event.name}
                            </span>
                            {' '}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({isEventChristmas ? 'Dec 25' : event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                            </span>
                            {index === 0 && (
                              <span className="ml-1 text-xs px-1 py-0.5 bg-pink-500/20 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full font-medium inline-block">
                                Next
                              </span>
                            )}
                          </div>
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
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EnhancedUpcomingEventsBanner; 