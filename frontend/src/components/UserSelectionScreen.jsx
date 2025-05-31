// frontend/src/components/UserSelectionScreen.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, setCurrentUserHeader } from '../services/api';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';  // Add this import

const UserSelectionScreen = () => {
  const { setSelectedUser, familyMembers, setFamilyMembers } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  console.log('UserSelection State:', { familyMembers }); // Debug log

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const response = await getFamilyMembers();
        console.log('Fetched family members:', response.data);
        setFamilyMembers(response.data);
      } catch (err) {
        console.error('Failed to fetch family members:', err);
        setError('Failed to load family members.');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [setFamilyMembers]);

  // Don't hardcode admin ID to -1, we'll find/create it properly
  const handleSelectUser = async (member) => {
    console.log('Selected member:', member);
    try {
      // If selecting admin but it's not a database object yet
      if (member.name?.toLowerCase() === 'admin' && !member.id) {
        // Find admin in current family members list first
        const adminUser = familyMembers.find(m => m.name.toLowerCase() === 'admin');
        if (adminUser) {
          console.log('Using existing admin user from list:', adminUser);
          setSelectedUser(adminUser);
          setCurrentUserHeader(adminUser.id);
        } else {
          // Emergency fallback - try to get admin via an API call
          console.log('Admin not found in current list, creating session-only admin');
          const tempAdmin = {
            id: 1, // Use a reasonable ID that likely exists
            name: 'Admin',
            is_admin: true
          };
          setSelectedUser(tempAdmin);
          setCurrentUserHeader(tempAdmin.id);
        }
      } else {
        // Normal user selection
        setSelectedUser(member);
        setCurrentUserHeader(member.id);
      }
      
      console.log('User set, navigating to dashboard');
      navigate('/');
    } catch (err) {
      console.error('Error selecting user:', err);
      setError('Failed to select user.');
    }
  };

  // Find admin in the footer section instead of hardcoding
  const adminUser = React.useMemo(() => {
    // First try to find in loaded family members
    const existingAdmin = familyMembers.find(m => m.name.toLowerCase() === 'admin');
    if (existingAdmin) return existingAdmin;
    
    // If not found, just use a basic object with the name
    return {
      name: 'Admin',
      is_admin: true
      // No ID - will be handled in handleSelectUser
    };
  }, [familyMembers]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-10">
      {/* Always show Admin Access - moved outside of conditional rendering */}
      <button
        onClick={() => handleSelectUser(adminUser)}
        className="fixed bottom-2 right-2 p-2 text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-600 transition-colors opacity-30 hover:opacity-60 z-50"
        aria-label="Admin access"
      >
        <Settings size={16} />
      </button>

      <motion.div 
        className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">
          Who are you?
        </h2>
        
        {/* Add explanation text here */}
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          Select your name from the list below. This helps keep gifts a surprise – always select your own name, not someone you're shopping for!
        </p>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-6">
            {error}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              An admin will need to access the migration manager to check for issues.
            </p>
            <button className="block mx-auto mt-4 px-4 py-2 bg-primary text-white rounded" onClick={fetchFamilyMembers}>
              Retry
            </button>
          </div>
        ) : (
          <ul className="space-y-2 mb-4">
            {familyMembers
              .filter(member => !member.name.toLowerCase().includes('admin'))
              .map((member) => (
                <motion.button
                  key={member.id}
                  onClick={() => handleSelectUser(member)}
                  className={`p-4 md:p-6 ${
                    setSelectedUser?.id === member.id
                      ? 'bg-primary text-white dark:bg-primary-600'
                      : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white'
                  } rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75
                    transform hover:scale-105 transition-all duration-200 ease-in-out text-lg font-semibold`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {member.name}
                  <p className="text-xs opacity-75">{member.wishlist_item_count} items</p>
                </motion.button>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
};

export default UserSelectionScreen;