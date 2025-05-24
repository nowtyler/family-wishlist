// frontend/src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';

const Navbar = () => {
  const { selectedUser, logout, setSelectedUser } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleChangeUser = () => {
    setSelectedUser(null); // Clear selected user, will redirect to user selection
    navigate('/select-user');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-primary hover:text-blue-700">
          Family Wishlist
        </Link>
        <div className="flex items-center space-x-4">
          {selectedUser && (
            <span className="text-neutral">
              Viewing as: <strong className="text-gray-700">{selectedUser.name}</strong>
            </span>
          )}
          <button
            onClick={handleChangeUser}
            className="px-3 py-1 text-sm text-primary border border-primary rounded hover:bg-primary hover:text-white transition-colors"
          >
            Change User
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-sm text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;