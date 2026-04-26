import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Shirt } from 'lucide-react';
import UserPreferencesPanel from './UserPreferencesPanel';

const UserPreferencesDropdown = ({
  member,
  isOwner,
  currentUserId,
  onUpdateSuccess = () => {},
  isOpen,
  onOpenChange,
  hideTrigger = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownOpen = typeof isOpen === 'boolean' ? isOpen : isDropdownOpen;
  const setDropdownOpen = (nextOpen) => {
    if (typeof isOpen === 'boolean') {
      onOpenChange?.(nextOpen);
    } else {
      setIsDropdownOpen(nextOpen);
    }
  };
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  return (
    <div className="relative" ref={dropdownRef}>
      {!hideTrigger && (
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 text-gray-700 dark:text-gray-300 rounded-full text-sm transition-colors"
          title="Sizes & Preferences"
        >
          <Shirt size={16} className="text-indigo-500 dark:text-indigo-400" />
          <ChevronDown
            size={12}
            className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      <AnimatePresence>
        {dropdownOpen && (
          <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${!hideTrigger ? 'sm:contents' : ''}`}
            onClick={(e) => { if (e.target === e.currentTarget) setDropdownOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 bg-black/50 z-[100] ${!hideTrigger ? 'sm:hidden' : ''}`}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`relative w-full max-w-sm bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden z-[110] ${!hideTrigger ? 'sm:absolute sm:w-80 sm:right-0 sm:mt-2' : ''}`}
            >
              <div className="p-4">
                <UserPreferencesPanel
                  member={member}
                  isOwner={isOwner}
                  onUpdateSuccess={onUpdateSuccess}
                  onClose={() => setDropdownOpen(false)}
                  isActive={dropdownOpen}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserPreferencesDropdown;
