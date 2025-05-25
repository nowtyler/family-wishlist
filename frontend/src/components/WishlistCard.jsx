// WishlistCard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, ThumbsUp } from 'lucide-react'; // You'll need to install lucide-react

function WishlistCard({ member, items, isLoading, isOwnWishlist, currentUserId, onUpdateItems, onDeleteItem, onThinkingAbout }) {
  const [selectedItem, setSelectedItem] = useState(null);

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const renderThinkingAbout = (item) => {
    if (isOwnWishlist) return null;
    
    const isThinking = item.thinking_about_by_list?.includes(currentUserId);
    const thinkingCount = item.thinking_about_by_list?.length || 0;
    
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onThinkingAbout(item.id);
          }}
          className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition-colors ${
            isThinking
              ? 'bg-primary text-white'
              : 'text-primary hover:bg-primary/10'
          }`}
        >
          <ThumbsUp size={14} />
          <span>Thinking</span>
          {thinkingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
              {thinkingCount}
            </span>
          )}
        </button>
        {item.thinking_about_by_list?.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {item.thinking_about_by_list.join(', ')}
          </span>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="animate-pulse p-4 bg-white rounded-lg shadow">Loading wishlist...</div>;
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-4">
              No items in this wishlist yet.
            </p>
          ) : (
            items.map(item => (
              <motion.div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                whileHover={{ y: -2 }}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{item.title}</h3>
                  {isOwnWishlist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete item"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                {item.description && (
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-2">{item.description}</p>
                )}

                {item.image_url && (
                  <img 
                    src={item.image_url} 
                    alt={item.title}
                    className="w-full h-32 object-cover rounded-md mb-2"
                  />
                )}

                <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.priority === 2 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                    item.priority === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {item.priority === 2 ? 'High' :
                     item.priority === 1 ? 'Medium' : 'Low'} Priority
                  </span>
                  {renderThinkingAbout(item)}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{selectedItem.title}</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>

              {selectedItem.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">{selectedItem.description}</p>
              )}

              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  className="w-full max-h-96 object-contain rounded-lg mb-4"
                />
              )}

              {selectedItem.link && (
                <a
                  href={selectedItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-dark mb-4"
                >
                  <ExternalLink size={16} />
                  <span>View Item</span>
                </a>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

export default WishlistCard;