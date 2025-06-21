import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, MessageCircleHeart, ShoppingCart, MessageCircle, Trash2, Plus, Pencil, 
  Gift, Moon, Sun, Settings, User, Database, RotateCcw, TriangleAlert,
  RefreshCw, Archive, Home, Ruler
} from 'lucide-react';

const HelpModal = ({ isOpen, onClose, isAdmin }) => {
  if (!isOpen) return null;

  const HelpSection = ({ title, children, icon, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      pink: "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800",
      green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
      gray: "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700",
      emerald: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
    };

    const iconColorClasses = {
      blue: "text-blue-600 dark:text-blue-400",
      pink: "text-pink-600 dark:text-pink-400", 
      green: "text-green-600 dark:text-green-400",
      amber: "text-amber-600 dark:text-amber-400",
      red: "text-red-600 dark:text-red-400",
      indigo: "text-indigo-600 dark:text-indigo-400",
      gray: "text-gray-600 dark:text-gray-400",
      emerald: "text-emerald-600 dark:text-emerald-400"
    };

    return (
      <div className={`p-4 rounded-lg border mb-4 ${colorClasses[color]}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`${iconColorClasses[color]}`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <div className="ml-7 text-gray-700 dark:text-gray-300 text-sm space-y-2">
          {children}
        </div>
      </div>
    );
  };

  const ActionButton = ({ icon, children, color }) => {
    const bgColor = {
      pink: "bg-pink-500 text-white",
      green: "bg-green-500 text-white",
      blue: "bg-blue-500 text-white",
      red: "bg-red-500 text-white",
      gray: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
      indigo: "bg-gradient-to-r from-sky-500 to-indigo-500 text-white",
      emerald: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
    };

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${bgColor[color]} rounded-full text-sm mr-2`}>
        {icon}
        <span>{children}</span>
      </div>
    );
  };
  
  const Feature = ({ icon, title, children, color = "gray" }) => {
    const colorClasses = {
      blue: "text-blue-600 dark:text-blue-400",
      pink: "text-pink-600 dark:text-pink-400", 
      green: "text-green-600 dark:text-green-400",
      amber: "text-amber-600 dark:text-amber-400",
      red: "text-red-600 dark:text-red-400",
      indigo: "text-indigo-600 dark:text-indigo-400",
      gray: "text-gray-600 dark:text-gray-400",
      emerald: "text-emerald-600 dark:text-emerald-400"
    };

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`${colorClasses[color]}`}>
            {icon}
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        </div>
        <div className="ml-7 text-gray-600 dark:text-gray-400 text-sm">
          {children}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto relative"
        >
          <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <span className="bg-gradient-to-r from-sky-500 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent mr-2">
                Help & Tips
              </span>
              {isAdmin && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs rounded-full">
                  ADMIN
                </span>
              )}
            </h2>
          </div>

          {/* User Help Content */}
          <div className="space-y-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Welcome to Family Wishlist! This guide will help you understand how to use all features of the application.
            </p>
            
            {/* Navigation Section */}
            <HelpSection 
              title="Navigating the App" 
              icon={<Gift size={20} />}
              color="indigo"
            >
              <Feature 
                icon={<Gift size={18} />} 
                title="Browse Wishlists" 
                color="indigo"
              >
                <p>Click on "Browse Wishlists" to see all family members' wishlists. Click any name to view their wishlist.</p>
              </Feature>
              
              <Feature 
                icon={<Home size={18} />} 
                title="Return to Your Wishlist" 
                color="emerald"
              >
                <p>When viewing someone else's wishlist, a home button appears at the bottom right of the screen. 
                Click this to return to your own wishlist.</p>
                <div className="mt-1">
                  <ActionButton icon={<Home size={14} />} color="emerald">
                    Home
                  </ActionButton>
                </div>
              </Feature>
            </HelpSection>

            {/* Managing Items Section */}
            <HelpSection 
              title="Managing Your Wishlist" 
              icon={<Plus size={20} />}
              color="blue"
            >
              <Feature 
                icon={<Plus size={18} />} 
                title="Adding Items" 
                color="blue"
              >
                <p>Click the "+ button" in the bottom-right corner to add a new item to your wishlist. 
                You can also import product details by pasting a URL from popular shopping websites.</p>
                
                <p className="mt-1">When adding or editing an item, open the "Show additional details" section to specify item-specific sizes. 
                This is especially useful for clothing and footwear where the exact size needed may vary between brands or items.</p>
                
                <div className="mt-1">
                  <ActionButton icon={<Plus size={14} />} color="indigo">
                    Add Item
                  </ActionButton>
                </div>
              </Feature>
              
              <Feature 
                icon={<Pencil size={18} />} 
                title="Editing Items" 
                color="blue"
              >
                <p>Click the pencil icon on any of your items to edit its details. You can modify the title, description, price, priority, and links.</p>
                <p className="mt-1">You can also add or update specific size information for each item - helpful when the size varies between products.</p>
              </Feature>
              
              <Feature 
                icon={<Ruler size={18} />} 
                title="Item-Specific Sizing" 
                color="indigo"
              >
                <p>When adding or editing items, you can specify detailed size information such as:</p>
                <ul className="list-disc ml-6 mt-1 space-y-1">
                  <li>T-shirt/hoodie sizes (XS through XXXL)</li>
                  <li>Pants with waist/length measurements (32x34)</li>
                  <li>Women's dress sizes (including letter and number sizes)</li>
                  <li>Shoe sizes with half sizes for perfect fit</li>
                </ul>
                <p className="mt-1">This item-specific sizing is added to the description and helps ensure family members buy the exact right size for each gift.</p>
              </Feature>
              
              <Feature 
                icon={<Trash2 size={18} />} 
                title="Deleting Items" 
                color="red"
              >
                <p>Click the trash icon on any item to remove it from your wishlist.</p>
              </Feature>
            </HelpSection>

            {/* Gift Coordination Section */}
            <HelpSection 
              title="Gift Coordination" 
              icon={<MessageCircleHeart size={20} />}
              color="pink"
            >
              <Feature 
                icon={<MessageCircleHeart size={18} className="fill-pink-500 text-white" />} 
                title="Expressing Interest" 
                color="pink"
              >
                <p>Click the heart icon on any item in someone else's wishlist to indicate you're interested in purchasing it. 
                Multiple people can express interest in the same item.</p>
                <div className="mt-1">
                  <ActionButton icon={<MessageCircleHeart size={14} className="fill-white" />} color="pink">
                    Interested
                  </ActionButton>
                </div>
              </Feature>
              
              <Feature 
                icon={<ShoppingCart size={18} className="fill-green-500 text-white" />} 
                title="Marking as Purchased" 
                color="green"
              >
                <p>Click the shopping cart icon to mark an item as purchased. This doesn't hide the item from the wishlist owner 
                but shows other family members that it has been purchased. Only one person can mark an item as purchased.</p>
                <div className="mt-1">
                  <ActionButton icon={<ShoppingCart size={14} className="fill-white" />} color="green">
                    Purchased
                  </ActionButton>
                </div>
              </Feature>
              
              <Feature 
                icon={<MessageCircle size={18} />} 
                title="Adding Comments" 
                color="blue"
              >
                <p>Click on any wishlist item to open detailed view, then add comments at the bottom. 
                Comments are visible to everyone except the wishlist owner. This is great for coordinating gift plans!</p>
              </Feature>
            </HelpSection>

            {/* Settings and Preferences */}
            <HelpSection 
              title="Settings and Preferences" 
              icon={<Settings size={20} />}
              color="gray"
            >
              <Feature 
                icon={<Sun size={18} />} 
                title="Light/Dark Mode" 
                color="amber"
              >
                <p>Toggle between light and dark mode by clicking the sun/moon icon in the top navigation bar.</p>
                <div className="mt-1 flex gap-2">
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded">
                    <Sun size={14} />
                    <span>Light Mode</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                    <Moon size={14} />
                    <span>Dark Mode</span>
                  </div>
                </div>
              </Feature>
              
              {/* Add new feature about size preferences */}
              <Feature 
                icon={<Ruler size={18} />} 
                title="Size Preferences" 
                color="blue"
              >
                <p>Click "Sizes & Preferences" in your wishlist header to set your general clothing and shoe sizes. 
                These are visible to all family members and help them buy the right sizes for you.</p>
                <p className="mt-1">You can set preferences for t-shirts, hoodies, pants, dresses, shoes, wrist size, and more. 
                You can also add general notes about your preferences.</p>
                <div className="mt-1">
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded">
                    <Ruler size={14} />
                    <span>Sizes & Preferences</span>
                  </div>
                </div>
              </Feature>
              
              <Feature 
                icon={<User size={18} />} 
                title="Change User" 
                color="gray"
              >
                <p>Click the settings gear icon, then select "Change User" to switch to a different family member.
                    You really shouldn't need to do this unless you made a mistake when logging in.</p>
              </Feature>
              
              <Feature 
                icon={<Trash2 size={18} />} 
                title="Clear Your Wishlist" 
                color="red"
              >
                <p>Click the settings gear icon, then select "Clear Wishlist" to delete all items from your wishlist at once. 
                This action cannot be undone, so use it carefully!</p>
              </Feature>
            </HelpSection>

            {/* External Wishlist Section */}
            <HelpSection 
              title="External Wishlists" 
              icon={<Gift size={20} />}
              color="indigo"
            >
              <p>You can link to external wishlists from services like Amazon, Etsy, and others.</p>
              <Feature 
                icon={<Plus size={18} />} 
                title="Adding External Wishlists" 
                color="blue"
              >
                <p>Click the "External Wishlists" button in your wishlist header, then click "Add External Wishlist" to add links to your wishlists on other sites.</p>
              </Feature>
            </HelpSection>
            
            {/* Admin Only Content */}
            {isAdmin && (
              <>
                <h3 className="text-xl font-bold text-amber-500 dark:text-amber-400 mt-8 mb-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                  Admin-Only Features
                </h3>
                
                <HelpSection 
                  title="Database Management" 
                  icon={<Database size={20} />}
                  color="amber"
                >
                  <Feature 
                    icon={<Database size={18} />} 
                    title="Migrations" 
                    color="blue"
                  >
                    <p>Migrations update the database structure when application updates require schema changes. 
                    Access the migration manager from the gear icon → Manage Migrations.</p>
                    <p className="mt-1 text-amber-600 dark:text-amber-400">
                      <TriangleAlert size={14} className="inline mr-1" />
                      Always back up your database before running migrations.
                    </p>
                  </Feature>
                  
                  <Feature 
                    icon={<Archive size={18} />} 
                    title="Backups" 
                    color="blue"
                  >
                    <p>The system automatically creates a backup before each migration. 
                    You can also create manual backups from the migration manager:</p>
                    <ul className="list-disc ml-6 mt-1 space-y-1">
                      <li>Create Backup: Makes a new backup of the current database</li>
                      <li>Restore Backup: Reverts the database to a previous state</li>
                      <li>Delete Backup: Removes unnecessary backup files</li>
                    </ul>
                  </Feature>
                </HelpSection>

                <HelpSection 
                  title="Administrative Actions" 
                  icon={<Settings size={20} />}
                  color="red"
                >
                  <Feature 
                    icon={<Trash2 size={18} />} 
                    title="Clear All Wishlists" 
                    color="red"
                  >
                    <p>As an admin, you can clear all wishlists for all users at once. This is useful for resetting the system
                    after an event or holiday season. Access this feature from the gear icon → Clear All Wishlists.</p>
                    <p className="mt-1 text-red-600 dark:text-red-400">
                      <TriangleAlert size={14} className="inline mr-1" />
                      This action cannot be undone! Always create a backup first.
                    </p>
                  </Feature>
                  
                  <Feature 
                    icon={<RefreshCw size={18} />} 
                    title="Version Management" 
                    color="blue"
                  >
                    <p>You can update the application version number displayed in the navbar. 
                    Click on the version number shown next to "Family Wishlist" to edit it.</p>
                  </Feature>
                </HelpSection>

                <HelpSection 
                  title="Best Practices for Admins" 
                  icon={<TriangleAlert size={20} />}
                  color="amber"
                >
                  <ul className="list-disc ml-4 space-y-2">
                    <li><strong>Regular Backups:</strong> Create backups before major events and before running migrations</li>
                    <li><strong>Migration Timing:</strong> Run migrations during low-usage periods</li>
                    <li><strong>Test Restores:</strong> Periodically verify that backups can be successfully restored</li>
                    <li><strong>Year-End Reset:</strong> Consider clearing all wishlists at the beginning of a new year or after major holidays</li>
                  </ul>
                </HelpSection>
              </>
            )}
          </div>

          {/* Sticky Close Button */}
          <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HelpModal;
