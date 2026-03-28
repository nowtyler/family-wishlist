// frontend/src/contexts/AppContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { setCurrentUserHeader, getFamilyMembers, clearApiCache, logoutUser, getUserProfile } from '../services/api';
import { log } from '../utils/logger';

const AppContext = createContext(null);

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
      sessionStorage.setItem('wishlistSelectedUser', JSON.stringify(selectedUser));
    } else {
      sessionStorage.removeItem('wishlistSelectedUser');
    }
  }, [selectedUser]);

  // On app mount, refresh the current user's profile from the API to ensure we have the latest data
  // This is especially important for flags like first_login that might be updated server-side
  useEffect(() => {
    const refreshUserProfileOnMount = async () => {
      if (isAuthenticated && selectedUser?.id) {
        try {
          log('AppContext: Refreshing user profile from API on mount...');
          const response = await getUserProfile(selectedUser.id);
          if (response.data) {
            log('AppContext: User profile refreshed, first_login:', response.data.first_login);
            // Update selectedUser with fresh data from API
            setSelectedUser(response.data);
          }
        } catch (error) {
          console.error('AppContext: Failed to refresh user profile on mount:', error);
          // Don't fail silently - just log and continue with cached data
        }
      }
    };

    // Run after a short delay to ensure app is fully mounted
    const timeoutId = setTimeout(refreshUserProfileOnMount, 100);
    return () => clearTimeout(timeoutId);
  }, []); // Run only on mount


  const login = (direct = false) => {
    setIsAuthenticated(true);
    setDirectLogin(direct);
    // Clear any existing family members to force a fresh fetch
    setFamilyMembers([]);
  };

  const logout = () => {
    // Get the username before clearing state
    const username = selectedUser?.username;
    
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
    
    // Record the logout on the server (for audit logging)
    if (username) {
      logoutUser(username).catch(error => {
        console.error('Failed to record logout:', error);
      });
    }
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
