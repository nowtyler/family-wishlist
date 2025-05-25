// frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';

// Add debugging for API client creation
console.log('Environment:', import.meta.env.MODE);
console.log('API Base URL:', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increased timeout for better handling in Docker
  timeout: 10000,
  withCredentials: true, // Important for CORS
  validateStatus: (status) => {
    return status >= 200 && status < 500;
  },
});

// Add request/response interceptors for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('Response Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config,
    });
    // Transform network errors into user-friendly messages
    if (!error.response) {
      error.userMessage = 'Unable to reach the server. Please check your connection.';
    } else if (error.response.status === 404) {
      error.userMessage = 'The requested resource was not found.';
    } else if (error.response.status >= 500) {
      error.userMessage = 'A server error occurred. Please try again later.';
    }
    return Promise.reject(error);
  }
);

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
    console.log('Attempting password verification...');
    const response = await apiClient.post('/auth/verify-password', { password });
    console.log('Verification response:', response);
    return response;
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      response: error.response,
      request: error.request,
      config: error.config
    });
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