// frontend/src/components/UserSelectionScreen.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { getFamilyMembers, setCurrentUserHeader } from '../services/api';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';  // Add this import

const UserSelectionScreen = () => {
  const { familyMembers, setFamilyMembers, setSelectedUser, selectedUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  console.log('UserSelection State:', { familyMembers, selectedUser }); // Debug log

  useEffect(() => {
    if (selectedUser) {
      console.log('Redirecting to dashboard, user:', selectedUser);
      navigate('/');
      return;
    }

    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const response = await getFamilyMembers();
        console.log('Fetched family members:', response.data);
        setFamilyMembers(response.data);
      } catch (err) {
        console.error('Failed to fetch family members:', err);
        setError('Failed to load family members.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMembers();
  }, [selectedUser, navigate, setFamilyMembers]);

  const handleSelectUser = async (member) => {
    console.log('Selected member:', member);
    try {
      setSelectedUser(member);
      setCurrentUserHeader(member.id);
      console.log('User set, navigating to dashboard');
      // If this is the admin user, navigate to admin dashboard
      const isAdmin = member?.name?.toLowerCase() === 'admin';
      navigate(isAdmin ? '/' : '/');  // Both go to dashboard now, but we keep the logic for future admin features
    } catch (err) {
      console.error('Error selecting user:', err);
      setError('Failed to select user.');
    }
  };

  // Add admin object outside of render logic
  const adminUser = {
    id: -1,
    name: 'admin',
    is_admin: true
  };

  return (
    <div className="relative min-h-screen">
      {/* Always show Admin Access - moved outside of conditional rendering */}
      <button
        onClick={() => handleSelectUser(adminUser)}
        className="fixed bottom-2 right-2 p-2 text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-600 transition-colors opacity-30 hover:opacity-60 z-50"
        aria-label="Admin access"
      >
        <Settings size={16} />
      </button>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-sky-100 dark:from-gray-900 dark:to-gray-800"
      >
        <div className="w-full max-w-2xl p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Who are you?</h2>
          {error && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                An admin will need to access the migration manager to check for issues.
              </p>
            </div>
          )}
          {familyMembers.length === 0 && !isLoading && (
            <p className="text-gray-600 dark:text-gray-400">No family members found.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {familyMembers
              .filter(member => !member.name.toLowerCase().includes('admin'))
              .map((member) => (
                <motion.button
                  key={member.id}
                  onClick={() => handleSelectUser(member)}
                  className={`p-4 md:p-6 ${
                    selectedUser?.id === member.id
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
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserSelectionScreen;