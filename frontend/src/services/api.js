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

export const createWishlistItem = async (ownerId, itemData) => {
  try {
    console.log('Creating wishlist item:', { ownerId, itemData });
    // No need to reformat here since it's already done in the form
    const response = await apiClient.post(`/members/${ownerId}/items`, itemData);
    console.log('Create item response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to create item:', error?.response?.data || error);
    throw error;
  }
};

export const updateWishlistItem = async (itemId, itemData) => {
  try {
    console.log('Updating wishlist item:', { itemId, itemData });
    // Clean up data before sending
    const cleanData = {
      title: itemData.title,
      description: itemData.description || null,
      link: itemData.link || null,
      image_url: itemData.image_url || null,
      priority: Number(itemData.priority)
    };
    const response = await apiClient.put(`/items/${itemId}`, cleanData);
    console.log('Update response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to update item:', error?.response?.data || error);
    throw error;
  }
};

export const deleteWishlistItem = (itemId) => {
  return apiClient.delete(`/items/${itemId}`);
};

export const toggleThinkingAbout = (itemId) => {
  return apiClient.patch(`/items/${itemId}/toggle-thinking`);
};

export const markPurchased = async (itemId) => {
  try {
    // Change to just toggle like the thinking_about endpoint
    return await apiClient.patch(`/items/${itemId}/toggle-purchased`);
  } catch (error) {
    console.error('Failed to toggle purchase status:', error?.response?.data || error);
    throw error;
  }
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