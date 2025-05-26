// frontend/src/contexts/AppContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { setCurrentUserHeader } from '../services/api';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('wishlistAuthenticated') === 'true'
  );
  const [familyMembers, setFamilyMembers] = useState([]); // Initialize as empty array
  const [selectedUser, setSelectedUser] = useState(() => {
    const savedUser = sessionStorage.getItem('wishlistSelectedUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (isAuthenticated && selectedUser) {
      setCurrentUserHeader(selectedUser.id);
    } else {
      setCurrentUserHeader(null);
    }
  }, [isAuthenticated, selectedUser]);

  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.setItem('wishlistAuthenticated', 'true');
    } else {
      sessionStorage.removeItem('wishlistAuthenticated');
      sessionStorage.removeItem('wishlistSelectedUser'); // Also clear user on logout
      setSelectedUser(null); // Clear selected user state
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedUser) {
      sessionStorage.setItem('wishlistSelectedUser', JSON.stringify(selectedUser));
    } else {
      sessionStorage.removeItem('wishlistSelectedUser');
    }
  }, [selectedUser]);


  const login = () => setIsAuthenticated(true);
  const logout = () => {
    setIsAuthenticated(false);
    // setSelectedUser(null); // Done by useEffect for isAuthenticated
    // setCurrentUserHeader(null); // Done by useEffect for selectedUser
  };


  const value = {
    isAuthenticated,
    login,
    logout,
    familyMembers,
    setFamilyMembers,
    selectedUser,
    setSelectedUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};