import React from 'react';
import { Calendar, Sparkles } from 'lucide-react';

const PostEventWishlistReminderModal = ({
  isOpen,
  wishlistName,
  title = 'Wishlist update reminder',
  message = 'Please review this wishlist and remove or update anything already received.',
  secondaryMessage = 'Someone thinks this wishlist needs attention.',
  onDismiss
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-5 sm:p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-event-reminder-title"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="post-event-reminder-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {wishlistName}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 p-3 mb-3">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            <span>{message}</span>
          </div>
        </div>

        {secondaryMessage && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {secondaryMessage}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostEventWishlistReminderModal;
