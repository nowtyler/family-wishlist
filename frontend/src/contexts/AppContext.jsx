// frontend/src/contexts/AppContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { setCurrentUserHeader, getAdminAccess, getFamilyMembers, clearApiCache } from '../services/api';

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

  // New state to track direct login vs legacy login
  const [directLogin, setDirectLogin] = useState(
    sessionStorage.getItem('wishlistDirectLogin') === 'true'
  );

  // TODO: Security improvement - Consider using HTTP-only cookies for sensitive authentication data
  // instead of sessionStorage, which can be manipulated by client-side JavaScript
  // This would provide better security against XSS attacks

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
    }
    // Note: logout function now handles clearing session storage and state
  }, [isAuthenticated]);

  useEffect(() => {
    if (directLogin) {
      sessionStorage.setItem('wishlistDirectLogin', 'true');
    } else {
      sessionStorage.removeItem('wishlistDirectLogin');
    }
  }, [directLogin]);

  useEffect(() => {
    if (selectedUser) {
      // If the selected user is Admin but has an invalid ID, try to get proper admin data
      if (selectedUser.is_admin && (!selectedUser.id || selectedUser.id < 0)) {
        const getProperAdminAccess = async () => {
          try {
            const adminData = await getAdminAccess({});
            if (adminData && adminData.id) {
              setSelectedUser({
                ...selectedUser,
                id: adminData.id,
                name: adminData.name || selectedUser.name
              });
            }
          } catch (err) {
            console.error('Failed to get proper admin access:', err);
            // Keep the current selectedUser
          }
        };
        getProperAdminAccess();
      }
      
      sessionStorage.setItem('wishlistSelectedUser', JSON.stringify(selectedUser));
    } else {
      sessionStorage.removeItem('wishlistSelectedUser');
    }
  }, [selectedUser]);


  const login = (direct = false) => {
    setIsAuthenticated(true);
    setDirectLogin(direct);
    // Clear any existing family members to force a fresh fetch
    setFamilyMembers([]);
  };

  const logout = () => {
    setIsAuthenticated(false);
    // Clear all cached data to prevent it from showing to the next user
    setFamilyMembers([]);
    setSelectedUser(null);
    setDirectLogin(false);
    setCurrentUserHeader(null);
    
    // Clear all session storage related to the app
    sessionStorage.removeItem('wishlistAuthenticated');
    sessionStorage.removeItem('wishlistSelectedUser');
    sessionStorage.removeItem('wishlistDirectLogin');
    
    // Clear API cache to ensure fresh data for next user
    clearApiCache();
  };

  // Add a function to refresh family members data
  const refreshFamilyMembers = async () => {
    try {
      const response = await getFamilyMembers();
      setFamilyMembers(response.data || []);
    } catch (err) {
      console.error('Failed to refresh family members:', err);
    }
  };

  // Add a function to completely reset and refresh all data
  const forceRefreshAllData = async () => {
    // Clear current data
    setFamilyMembers([]);
    
    // Clear API cache
    clearApiCache();
    
    // Fetch fresh data
    await refreshFamilyMembers();
  };

  // Add refreshFamilyMembers to the context value
  const value = {
    isAuthenticated,
    login,
    logout,
    familyMembers,
    setFamilyMembers,
    selectedUser,
    setSelectedUser,
    refreshFamilyMembers,
    forceRefreshAllData,
    directLogin,
    setDirectLogin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};