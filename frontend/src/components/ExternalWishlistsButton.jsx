import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2 } from 'lucide-react';
import ExternalWishlistsPanel from './ExternalWishlistsPanel';

const ExternalWishlistsButton = ({ member, sharedWishlist, variant = "default", externalOpen = false, onExternalClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (externalOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [externalOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onExternalClose?.();
  }, [onExternalClose]);

  const modalRef = useRef(null);
  const isSharedMode = !!sharedWishlist;
  const displayName = isSharedMode ? sharedWishlist.name : member?.name;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClose]);

  const isFloating = variant === "floating";
  const isHidden = variant === "hidden";

  return (
    <>
      {!isHidden && (
        <button
          onClick={() => setIsOpen(true)}
          className={isFloating
            ? "w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400 text-white shadow-lg hover:from-amber-600 hover:to-orange-600 dark:hover:from-amber-500 dark:hover:to-orange-500 flex items-center justify-center transition-all duration-200"
            : "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 sm:w-auto w-full justify-center"
          }
          title="External Wishlists"
        >
          <Link2 size={isFloating ? 24 : 18} className="text-white" />
          {!isFloating && <span className="font-medium">External Wishlists</span>}
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[100]"
            />
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto relative z-[110]"
            >
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 pr-8 mb-4">
                  {displayName}'s External Wishlists
                </h3>

                <ExternalWishlistsPanel
                  member={member}
                  sharedWishlist={sharedWishlist}
                  isActive={isOpen}
                />

                <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ExternalWishlistsButton;
