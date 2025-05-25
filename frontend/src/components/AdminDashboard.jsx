import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';

const AdminDashboard = () => {
  const { familyMembers } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <button
            onClick={() => navigate('/select-user')}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            Back to User Selection
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {familyMembers.map(member => (
            <div
              key={member.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg"
            >
              <h3 className="text-xl font-semibold mb-4">{member.name}'s Wishlist</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {member.wishlist_item_count} items
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/admin/wishlists/${member.id}`)}
                  className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  View & Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
