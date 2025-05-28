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
    const cleanData = {
      ...itemData,
      link: itemData.link || null,
      image_url: itemData.image_url || null,
      description: itemData.description || null,
      price: itemData.price ? parseFloat(itemData.price) : null  // Backend will convert to cents
    };
    console.log('Sending data to API:', cleanData);
    const response = await apiClient.post(`/members/${ownerId}/items`, cleanData);
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
    const cleanData = {
      ...itemData,
      link: itemData.link || null,
      image_url: itemData.image_url || null,
      description: itemData.description || null,
      // Fix price handling to match create item
      price: itemData.price !== null && itemData.price !== undefined && itemData.price !== '' ? 
        parseFloat(itemData.price) : null  // Backend will convert to cents
    };
    console.log('Sending data to API:', cleanData);
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
export const addComment = async (itemId, text) => {
  try {
    console.log('Adding comment:', { itemId, text });
    const response = await apiClient.post(`/items/${itemId}/comments`, { text });
    console.log('Comment response:', response.data);
    return response;
  } catch (error) {
    console.error('Comment creation error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

export const deleteComment = (commentId) => {
  return apiClient.delete(`/comments/${commentId}`);
};

// --- Gift Reminder ---
export const getUpcomingEvent = () => {
  return apiClient.get('/upcoming-event');
};

// --- Version Management ---
export const getSystemVersion = () => {
  return apiClient.get('/system/version');
};

export const updateSystemVersion = (version) => {
  console.log('Updating system version to:', version);
  console.log('Current headers:', apiClient.defaults.headers);
  
  const userId = apiClient.defaults.headers.common['X-Current-User-Id'];
  console.log('Current user ID from header:', userId);
  
  return apiClient.put('/system/version', { version });
};

// Update the interceptor to get user ID from sessionStorage
apiClient.interceptors.request.use((config) => {
  const savedUser = sessionStorage.getItem('wishlistSelectedUser');
  const userId = savedUser ? JSON.parse(savedUser)?.id : null;
  
  if (userId) {
    config.headers['X-Current-User-Id'] = userId;
  }
  return config;
}, (error) => {
  console.error('Request Error:', error);
  return Promise.reject(error);
});

// --- Wishlist Items ---
export const deleteAllWishlistItems = (ownerId) => {
  return apiClient.delete(`/members/${ownerId}/items`);
};

export const clearAllWishlists = () => {
  return apiClient.delete('/admin/wishlists');
};

// --- Database Migrations ---
export const getMigrations = async () => {
  try {
    const response = await apiClient.get('/admin/migrations');
    return response;
  } catch (error) {
    console.error('Failed to fetch migrations:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

export const upgradeMigration = async (target) => {
  try {
    const response = await apiClient.post('/admin/migrations/upgrade', { target });
    return response;
  } catch (error) {
    console.error('Failed to upgrade database:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

export const createMigration = async (message) => {
  try {
    const response = await apiClient.post('/admin/migrations/create', { message });
    return response;
  } catch (error) {
    console.error('Failed to create migration:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

export const deleteMigration = async (version) => {
  try {
      const response = await apiClient.delete(`/admin/migrations/${version}`);
      return response;
  } catch (error) {
      console.error('Failed to delete migration:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
      });
      throw error;
  }
};

export const resetMigrationState = async () => {
  try {
    const response = await apiClient.post('/admin/migrations/reset');
    return response;
  } catch (error) {
    console.error('Failed to reset migration state:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

export const hardResetMigrations = async () => {
  try {
    const response = await apiClient.post('/admin/migrations/hard-reset');
    return response;
  } catch (error) {
    console.error('Failed to hard reset migrations:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

// --- Database Backups ---
export const createBackup = () => {
  return apiClient.post('/admin/backups/create');
};

export const getBackups = () => {
  return apiClient.get('/admin/backups');
};

export const restoreBackup = (filename) => {
  return apiClient.post(`/admin/backups/restore/${filename}`);
};

export const deleteBackup = (filename) => {
  return apiClient.delete(`/admin/backups/${filename}`);
};

// --- Schema Management ---
export const getSchemaHash = () => {
  return apiClient.get('/admin/schema/hash');
};

// --- Admin Access ---
export const getAdminAccess = async () => {
  try {
    const response = await apiClient.post('/admin/emergency-access');
    console.log('Admin access response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to get admin access:', error);
    throw error;
  }
};

// --- URL Import ---
export const fetchProductDetailsFromUrl = async (url) => {
  try {
    console.log('Fetching product details from URL:', url);
    const response = await apiClient.post('/items/fetch-url-details', { url });
    console.log('Product details response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch product details:', error?.response?.data || error);
    throw error;
  }
};

export default apiClient;