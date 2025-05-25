// frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to set the current user ID header
export const setCurrentUserHeader = (userId) => {
  if (userId) {
    apiClient.defaults.headers.common['X-Current-User-Id'] = userId;
  } else {
    delete apiClient.defaults.headers.common['X-Current-User-Id'];
  }
};

// --- Auth ---
export const verifyPassword = async (password) => {
  try {
    const response = await apiClient.post('/auth/verify-password', { password });
    return response;
  } catch (error) {
    console.error('Password verification error:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
};

// --- Family Members ---
export const getFamilyMembers = () => {
  return apiClient.get('/family-members');
};

// --- Wishlist Items ---
export const getWishlistItems = (ownerId) => {
  return apiClient.get(`/members/${ownerId}/items`);
};

export const createWishlistItem = (ownerId, itemData) => {
  return apiClient.post(`/members/${ownerId}/items`, itemData);
};

export const updateWishlistItem = (itemId, itemData) => {
  // Note: The backend's updateWishlistItem is a PUT and takes full item data
  // This might need adjustment based on how you want to handle partial updates.
  // The backend schema `WishlistItemUpdate` allows optional fields.
  return apiClient.put(`/items/${itemId}`, itemData);
};

export const deleteWishlistItem = (itemId) => {
  return apiClient.delete(`/items/${itemId}`);
};

export const toggleThinkingAbout = (itemId) => {
  return apiClient.patch(`/items/${itemId}/toggle-thinking`);
};

export const markPurchased = (itemId, purchased) => {
  return apiClient.patch(`/items/${itemId}/mark-purchased`, { purchased });
};

// --- Comments ---
export const addComment = (itemId, text) => {
  // The backend's CommentCreate schema now only needs 'text'.
  // author_id is derived from X-Current-User-Id header in the backend.
  return apiClient.post(`/items/${itemId}/comments`, { text });
};

// --- Gift Reminder ---
export const getUpcomingEvent = () => {
  return apiClient.get('/upcoming-event');
};

export default apiClient;