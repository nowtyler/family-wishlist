// frontend/src/services/api.js
import axios from 'axios';

// Fix the API base URL handling - use relative URL instead of absolute URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Add clearer debugging for API client creation
console.log('Environment:', import.meta.env.MODE);
console.log('API Base URL from env:', import.meta.env.VITE_API_BASE_URL);
console.log('API Base URL used:', API_BASE_URL);

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Increased timeout for better handling of large wishlist imports
    timeout: 60000, // Increased from 10000 to 60000 (1 minute)
    withCredentials: true, // Important for CORS
    validateStatus: (status) => {
        return status >= 200 && status < 400; // Only treat 2xx and 3xx as success
    },
});

// Improve the request logging to clarify what's happening
apiClient.interceptors.request.use(
    (config) => {
        // Show the actual full URL that will be requested (with baseURL resolved)
        const fullUrl = config.baseURL.endsWith('/') && config.url.startsWith('/') 
            ? `${config.baseURL}${config.url.substring(1)}` 
            : `${config.baseURL}${config.url}`;
            
        console.log('API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            resolvedUrl: fullUrl, // Changed to be more descriptive
            baseURL: config.baseURL, // Show the base URL separately
            headers: config.headers
        });
        return config;
    },
    (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor to handle rate limiting with exponential backoff
let rateLimitRetries = {};

apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data);
    return response;
  },
  async (error) => {
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
    
    // Only handle rate limit errors (status code 429) if not explicitly skipped
    if (error.response?.status === 429 && !error.config.headers['X-Skip-Rate-Limit-Retry']) {
      const requestId = `${error.config.method}-${error.config.url}-${Date.now()}`;
      
      // Track retries for this request
      rateLimitRetries[requestId] = (rateLimitRetries[requestId] || 0) + 1;
      
      // Max 3 retries with exponential backoff
      if (rateLimitRetries[requestId] <= 3) {
        const retryDelay = Math.pow(2, rateLimitRetries[requestId]) * 1000; // Exponential backoff
        console.log(`Rate limited. Retrying in ${retryDelay/1000} seconds...`);
        
        // Wait for the delay time
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Retry the request
        return apiClient(error.config);
      }
      
      // Clean up after max retries
      delete rateLimitRetries[requestId];
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

// Function to clear all cached API data (useful on logout)
export const clearApiCache = () => {
  // Clear any axios cached data by creating a cache-busting timestamp
  // This forces fresh requests for all subsequent API calls
  apiClient.defaults.headers.common['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  apiClient.defaults.headers.common['Pragma'] = 'no-cache';
  apiClient.defaults.headers.common['Expires'] = '0';
  
  // Remove user-specific headers
  delete apiClient.defaults.headers.common['X-Current-User-Id'];
  
  // Clear any pending requests (if needed)
  // Note: This is more aggressive and should only be used on logout
  return Promise.resolve();
};

// Function to record logout on the server for audit logging
export const logoutUser = async (username) => {
  try {
    await apiClient.post('/auth/logout', { username });
    return true;
  } catch (error) {
    console.error('Failed to record logout:', error);
    // Don't throw, as this is just for logging
    return false;
  }
};

// --- Auth ---
export const verifyPassword = async (password) => {
    try {
        console.log('Attempting password verification...');
        // Fix the endpoint path - should be consistent with backend
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

// New function to get complete user data including preferences
export const getUserProfile = async (userId) => {
  try {
    // Use a fresh request with cache busting to ensure we get the latest data
    const response = await apiClient.get(`/family-members/${userId}`, {
      params: {
        _t: new Date().getTime()
      }
    });
    console.log('Got user profile with complete preferences:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
};

export const loginUser = async (username, password, turnstileToken) => {
    try {
        const response = await apiClient.post('/auth/login', {
            username,
            password,
            turnstile_token: turnstileToken || undefined,
        });
        return response;
    } catch (error) {
        console.error('Login error:', {
            message: error.message,
            response: error.response
        });
        throw error;
    }
};

export const registerUser = async (userData) => {
    try {
        const response = await apiClient.post('/auth/register', userData);
        return response;
    } catch (error) {
        console.error('Registration error:', {
            message: error.message,
            response: error.response
        });
        throw error;
    }
};

// --- Shopping Cart ---
export const addShoppingCartItemFromWishlistItem = async (itemId, recipientId) => {
  try {
    const response = await apiClient.post(`/shopping-cart/from-wishlist-item/${itemId}`, {
      recipient_id: recipientId,
    });
    return response;
  } catch (error) {
    console.error('Failed to add wishlist item to shopping cart:', error);
    throw error;
  }
};

export const createShoppingCartItem = async (itemData) => {
  try {
    const response = await apiClient.post('/shopping-cart', itemData);
    return response;
  } catch (error) {
    console.error('Failed to create shopping cart item:', error);
    throw error;
  }
};

export const requestPasswordReset = async (usernameOrEmail, turnstileToken) => {
    try {
        const response = await apiClient.post('/auth/reset-password/request', {
            username_or_email: usernameOrEmail,
            turnstile_token: turnstileToken || undefined,
        });
        return response;
    } catch (error) {
        console.error('Password reset request error:', {
            message: error.message,
            response: error.response
        });
        throw error;
    }
};

export const confirmPasswordReset = async (token, newPassword) => {
    try {
        const response = await apiClient.post('/auth/reset-password/confirm', { token, new_password: newPassword });
        return response;
    } catch (error) {
        console.error('Password reset confirmation error:', {
            message: error.message,
            response: error.response
        });
        throw error;
    }
};

export const adminResetPassword = async (passphrase, newPassword, turnstileToken) => {
    try {
        const response = await apiClient.post('/auth/admin-reset-password', {
            passphrase,
            new_password: newPassword,
            turnstile_token: turnstileToken || undefined,
        });
        return response;
    } catch (error) {
        console.error('Admin passphrase reset error:', error);
        throw error;
    }
};

export const getRecoveryPassphrase = async () => {
    return apiClient.get('/admin/recovery-passphrase');
};

export const regenerateRecoveryPassphrase = async (currentPassword) => {
    return apiClient.post('/admin/recovery-passphrase/regenerate', {
        current_password: currentPassword,
    });
};

// --- Family Members ---
export const getFamilyMembers = () => {
  return apiClient.get('/family-members', {
    params: {
      _t: new Date().getTime() // Add cache-busting timestamp for fresh data
    }
  });
};

export const updateFamilyMemberPreferences = (memberId, preferences) => {
  return apiClient.put(`/members/${memberId}/preferences`, { preferences });
};

export const completeTutorial = (memberId) => {
  return apiClient.post(`/members/${memberId}/complete-tutorial`);
};

export const skipTutorial = (memberId) => {
  return apiClient.post(`/members/${memberId}/skip-tutorial`);
};

export const resetTutorial = (memberId) => {
  return apiClient.post(`/members/${memberId}/reset-tutorial`);
};

// New API functions for family member management
export const createFamilyMember = (memberData) => {
  return apiClient.post('/family-members', memberData);
};

export const updateFamilyMember = (memberId, memberData) => {
  return apiClient.put(`/family-members/${memberId}`, memberData);
};

export const deleteFamilyMember = (memberId) => {
  return apiClient.delete(`/family-members/${memberId}`);
};

// Admin user management functions
export const createUserWithAuth = (userData) => {
  return apiClient.post('/admin/users', userData);
};

export const updateUserWithAuth = (memberId, userData) => {
  return apiClient.put(`/admin/users/${memberId}`, userData);
};

export const updateUserProfile = (memberId, userData) => {
  return apiClient.put(`/users/${memberId}/profile`, userData);
};

// --- Wishlist Items ---
/**
 * Get wishlist items for a specific user
 * @param {number} ownerId - The user ID
 * @returns {Promise} API response with wishlist items
 */
export const getWishlistItems = (ownerId) => {
  return apiClient.get(`/members/${ownerId}/items`, {
    params: {
      _t: new Date().getTime() // Add cache-busting timestamp for fresh data
    }
  });
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

export const exportWishlist = async (ownerId) => {
  try {
    console.log('Exporting wishlist for owner:', ownerId);
    const response = await apiClient.get(`/members/${ownerId}/export`);
    console.log('Export response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to export wishlist:', error?.response?.data || error);
    throw error;
  }
};

export const importWishlist = async (ownerId, wishlistData) => {
  try {
    console.log('Importing wishlist for owner:', ownerId);
    const response = await apiClient.post(`/members/${ownerId}/import`, wishlistData);
    console.log('Import response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to import wishlist:', error?.response?.data || error);
    throw error;
  }
};

export const toggleThinkingAbout = async (itemId) => {
  try {
    const response = await apiClient.patch(`/items/${itemId}/toggle-thinking`);
    console.log('Toggle thinking_about response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to toggle thinking_about status:', error?.response?.data || error);
    throw error;
  }
};

export const markPurchased = async (itemId) => {
  try {
    const response = await apiClient.patch(`/items/${itemId}/toggle-purchased`);
    console.log('Toggle purchased response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to toggle purchase status:', error?.response?.data || error);
    throw error;
  }
};

// --- Comments ---
/**
 * Add a comment to a wishlist item
 * @param {number} itemId - Item ID to comment on
 * @param {string} text - Comment text
 * @returns {Promise} API response
 */
export const addComment = (itemId, text) => {
  // Update the endpoint to match what the backend expects
  return apiClient.post(`/items/${itemId}/comments`, { text });
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

export const deleteAllSharedWishlistItems = (wishlistId) => {
  return apiClient.delete(`/shared-wishlists/${wishlistId}/items`);
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

// Add a new function to reset schema hash
export const resetSchemaHash = async () => {
  try {
    const response = await apiClient.post('/admin/migrations/reset-schema-hash');
    return response;
  } catch (error) {
    console.error('Failed to reset schema hash:', {
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

export const downloadBackup = (filename) => {
  return apiClient.get(`/admin/backups/download/${filename}`, {
    responseType: 'blob' // Important for handling file downloads
  });
};

// --- Schema Management ---
export const getSchemaHash = () => {
  return apiClient.get('/admin/schema/hash');
};

// --- URL Import ---
export const fetchProductDetailsFromUrl = async (url) => {
  try {
    console.log('Fetching product details from URL:', url);
    const response = await apiClient.post('/items/fetch-url-details', { url });
    console.log('Product details response:', response.data);
    
    // We always return the response data, even if it contains an error
    // This allows the UI to handle the error in a user-friendly way
    return response.data;
  } catch (error) {
    console.error('Failed to fetch product details:', error?.response?.data || error);
    
    // Create a formatted error response similar to the server's format
    return {
      error: error?.response?.data?.detail || error.message || 'Network error',
      url: url,
      message: 'Unable to import product details. This website may block our scraper - please enter details manually.'
    };
  }
};

// --- External Wishlist Import ---
export const importExternalWishlist = async (url) => {
  try {
    console.log('Importing external wishlist:', url);
    const response = await apiClient.post('/wishlists/import', { url });
    console.log('Import response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to import wishlist:', error?.response?.data || error);
    throw error;
  }
};

export const syncExternalWishlist = async (url, ownerId, options = {}) => {
  try {
    const { addNewItems = true, removeMissingItems = false, defaultPriority = 1 } = options;
    console.log('Syncing external wishlist:', { url, ownerId, addNewItems, removeMissingItems, defaultPriority });
    
    const response = await apiClient.post('/wishlists/sync', { 
      url, 
      owner_id: ownerId,
      add_new_items: addNewItems,
      remove_missing_items: removeMissingItems,
      default_priority: defaultPriority
    });
    
    console.log('Sync response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to sync wishlist:', error?.response?.data || error);
    throw error;
  }
};

// --- External Wishlists ---
export const getExternalWishlists = (ownerId) => {
  return apiClient.get(`/members/${ownerId}/external-wishlists`);
};

export const createExternalWishlist = (ownerId, wishlistData) => {
  return apiClient.post(`/members/${ownerId}/external-wishlists`, wishlistData);
};

export const updateExternalWishlist = (wishlistId, wishlistData) => {
  return apiClient.put(`/external-wishlists/${wishlistId}`, wishlistData);
};

export const deleteExternalWishlist = (wishlistId) => {
  return apiClient.delete(`/external-wishlists/${wishlistId}`);
};

// --- Shared Wishlist External Wishlists ---
export const getSharedWishlistExternalWishlists = (wishlistId) => {
  return apiClient.get(`/shared-wishlists/${wishlistId}/external-wishlists`);
};

export const createSharedWishlistExternalWishlist = (wishlistId, wishlistData) => {
  return apiClient.post(`/shared-wishlists/${wishlistId}/external-wishlists`, wishlistData);
};

// --- Shopping Cart ---
export const getShoppingCartItems = (buyerId) => {
  return apiClient.get('/shopping-cart', {
    params: {
      buyer_id: buyerId,
      _t: new Date().getTime(),
    },
  });
};

export const updateShoppingCartItem = (cartItemId, updates) => {
  return apiClient.put(`/shopping-cart/${cartItemId}`, updates);
};

export const deleteShoppingCartItem = (cartItemId) => {
  return apiClient.delete(`/shopping-cart/${cartItemId}`);
};

export const copyShoppingCartItem = (cartItemId, overrides = {}) => {
  return apiClient.post(`/shopping-cart/${cartItemId}/copy`, overrides);
};

// --- Notifications ---
export const getNotifications = (userId) => {
  return apiClient.get('/notifications', { params: { user_id: userId } });
};

export const markNotificationRead = (notificationId) => {
  return apiClient.patch(`/notifications/${notificationId}`);
};

export const sendWishlistReminder = (memberId) => {
  return apiClient.post(`/members/${memberId}/send-wishlist-reminder`);
};

export const sendSharedWishlistOwnerReminder = (wishlistId) => {
  return apiClient.post(`/shared-wishlists/${wishlistId}/send-owner-reminder`);
};

// --- Admin Household Management ---
export const getHouseholds = () => {
  return apiClient.get('/admin/households');
};

export const getHouseholdsWithMembers = () => {
  return apiClient.get('/admin/households/with-members');
};

export const createHousehold = (householdData) => {
  return apiClient.post('/admin/households', householdData);
};

export const updateHousehold = (householdId, householdData) => {
  return apiClient.put(`/admin/households/${householdId}`, householdData);
};

export const deleteHousehold = (householdId) => {
  return apiClient.delete(`/admin/households/${householdId}`);
};

export const addUserToHousehold = (householdId, userId) => {
  return apiClient.post(`/admin/households/${householdId}/members`, { user_id: userId });
};

export const removeUserFromHousehold = (householdId, userId) => {
  return apiClient.delete(`/admin/households/${householdId}/members/${userId}`);
};

// --- Admin Email Management ---
export const getEmailSettings = () => {
  return apiClient.get('/admin/email/settings');
};

export const updateEmailSettings = (settings) => {
  return apiClient.put('/admin/email/settings', settings);
};

export const getEmailTemplates = () => {
  return apiClient.get('/admin/email/templates');
};

export const updateEmailTemplate = (templateName, templateData) => {
  return apiClient.put(`/admin/email/templates/${templateName}`, templateData);
};

export const createEmailTemplate = (templateData) => {
  return apiClient.post('/admin/email/templates', templateData);
};

export const testEmailSettings = (data) => {
  return apiClient.post('/admin/email/test', data);
};

export const deleteEmailTemplate = (templateId) => {
  return apiClient.delete(`/admin/email/templates/${templateId}`);
};

// --- Admin System Management ---
export const getSystemStats = () => {
  return apiClient.get('/admin/stats');
};

export const getAdminCartItems = () => {
  return apiClient.get('/admin/carts');
};

export const deleteAdminCartItem = (cartItemId) => {
  return apiClient.delete(`/admin/carts/${cartItemId}`);
};

export const clearAdminCarts = () => {
  return apiClient.delete('/admin/carts');
};

export const clearAdminCartByBuyer = (buyerId) => {
  return apiClient.delete(`/admin/carts/buyer/${buyerId}`);
};

export const clearAllData = () => {
  return apiClient.post('/admin/system/clear-all');
};

export const emergencyReset = () => {
  return apiClient.post('/admin/system/emergency-reset');
};

export const getSystemStatus = () => {
  return apiClient.get('/admin/system/status');
};

export const getSystemSettings = () => {
  return apiClient.get('/admin/system/settings');
};

export const updateSystemSettings = (settings) => {
  return apiClient.put('/admin/system/settings', settings);
};

export const setMaintenanceMode = (enabled) => {
  return apiClient.post('/admin/system/maintenance', { enabled });
};

export const clearSystemCache = () => {
  return apiClient.post('/admin/system/cache/clear');
};

export const checkSetupStatus = async () => {
  try {
    // Add a custom header to skip automatic retries for this specific endpoint
    const response = await apiClient.get('/system/setup-status', {
      headers: {
        'X-Skip-Rate-Limit-Retry': 'true'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to check setup status:', error);
    if (error.response?.status === 429) {
      // For rate limit errors, return a special response
      return {
        is_setup_complete: true, // Assume setup is complete when rate limited
        rate_limited: true,
        retry_after: parseInt(error.response.headers['retry-after']) || 30,
        error_message: error.response.data.detail || 'Too many requests. Please try again later.'
      };
    }
    throw error;
  }
};

export const firstTimeSetup = async (setupData) => {
  try {
    const response = await apiClient.post('/system/first-time-setup', setupData);
    return response.data;
  } catch (error) {
    console.error('First-time setup failed:', error);
    throw error;
  }
};

// Items management functions
export const getAllItems = () => {
  return apiClient.get('/admin/items');
};

export const deleteItemAsAdmin = (itemId) => {
  return apiClient.delete(`/admin/items/${itemId}`);
};

export const getDatabaseVersion = () => {
  return apiClient.get('/admin/system/database-version');
};

export const getAuthLogs = (params = {}) => {
    return apiClient.get('/admin/system/auth-logs', { params });
};

// --- User Household Management (Non-Admin) ---
export const getUserHouseholds = () => {
  return apiClient.get('/user/households');
};

export const getAllHouseholds = () => {
  return apiClient.get('/households');
};

export const createHouseholdByUser = (householdData) => {
  return apiClient.post('/households', householdData);
};

export const joinHousehold = (householdId) => {
  return apiClient.post(`/households/${householdId}/join`);
};

export const leaveHousehold = (householdId) => {
  return apiClient.delete(`/households/${householdId}/leave`);
};

export const setActiveHousehold = (householdId) => {
  return apiClient.put('/households/active', null, {
    params: { household_id: householdId }
  });
};

export const getApplicationLogs = (params = {}) => {
    return apiClient.get('/admin/system/logs', { params });
};

export const broadcastMaintenanceNotice = (maintenance_time, expected_downtime) => {
  return apiClient.post('/admin/email/broadcast-maintenance', { maintenance_time, expected_downtime });
};

export const broadcastWishlistUpdateReminder = () => {
  return apiClient.post('/admin/reminders/wishlist-update');
};

// --- Shared Wishlists (Kid Wishlists) ---
export const getSharedWishlists = () => {
  return apiClient.get('/shared-wishlists');
};

export const getSharedWishlistsAdmin = () => {
  return apiClient.get('/shared-wishlists', {
    params: { include_all: true }
  });
};

export const getSharedWishlist = (wishlistId) => {
  return apiClient.get(`/shared-wishlists/${wishlistId}`);
};

export const createSharedWishlist = (wishlistData) => {
  return apiClient.post('/shared-wishlists', wishlistData);
};

export const updateSharedWishlist = (wishlistId, wishlistData) => {
  return apiClient.put(`/shared-wishlists/${wishlistId}`, wishlistData);
};

export const deleteSharedWishlist = (wishlistId) => {
  return apiClient.delete(`/shared-wishlists/${wishlistId}`);
};

export const addSharedWishlistOwner = (wishlistId, username) => {
  return apiClient.post(`/shared-wishlists/${wishlistId}/owners`, { username });
};

export const removeSharedWishlistOwner = (wishlistId, ownerId) => {
  return apiClient.delete(`/shared-wishlists/${wishlistId}/owners/${ownerId}`);
};

export const getSharedWishlistItems = (wishlistId) => {
  return apiClient.get(`/shared-wishlists/${wishlistId}/items`);
};

export const createSharedWishlistItem = async (wishlistId, itemData) => {
  try {
    const cleanData = {
      ...itemData,
      link: itemData.link || null,
      image_url: itemData.image_url || null,
      description: itemData.description || null,
      price: itemData.price ? parseFloat(itemData.price) : null
    };
    const response = await apiClient.post(`/shared-wishlists/${wishlistId}/items`, cleanData);
    return response;
  } catch (error) {
    console.error('Failed to create shared wishlist item:', error);
    throw error;
  }
};

export const updateSharedWishlistItem = async (itemId, itemData) => {
  try {
    const cleanData = {
      ...itemData,
      link: itemData.link || null,
      image_url: itemData.image_url || null,
      description: itemData.description || null,
      price: itemData.price !== null && itemData.price !== undefined && itemData.price !== '' ?
        parseFloat(itemData.price) : null
    };
    const response = await apiClient.put(`/shared-wishlist-items/${itemId}`, cleanData);
    return response;
  } catch (error) {
    console.error('Failed to update shared wishlist item:', error);
    throw error;
  }
};

export const deleteSharedWishlistItem = (itemId) => {
  return apiClient.delete(`/shared-wishlist-items/${itemId}`);
};

export const toggleSharedItemThinking = (itemId) => {
  return apiClient.patch(`/shared-wishlist-items/${itemId}/toggle-thinking`);
};

export const toggleSharedItemPurchased = (itemId) => {
  return apiClient.patch(`/shared-wishlist-items/${itemId}/toggle-purchased`);
};

// Add shopping cart item from shared wishlist item
export const addShoppingCartItemFromSharedWishlistItem = async (itemId, sharedWishlistId) => {
  try {
    const response = await apiClient.post(`/shopping-cart/from-shared-wishlist-item/${itemId}`, {
      shared_wishlist_id: sharedWishlistId,
    });
    return response;
  } catch (error) {
    console.error('Failed to add shared wishlist item to shopping cart:', error);
    throw error;
  }
};

// Export shared wishlist
export const exportSharedWishlist = async (wishlistId) => {
  try {
    console.log('Exporting shared wishlist:', wishlistId);
    const response = await apiClient.get(`/shared-wishlists/${wishlistId}/export`);
    console.log('Export response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to export shared wishlist:', error?.response?.data || error);
    throw error;
  }
};

// Import shared wishlist
export const importSharedWishlist = async (wishlistId, wishlistData) => {
  try {
    console.log('Importing shared wishlist:', wishlistId);
    const response = await apiClient.post(`/shared-wishlists/${wishlistId}/import`, wishlistData);
    console.log('Import response:', response.data);
    return response;
  } catch (error) {
    console.error('Failed to import shared wishlist:', error?.response?.data || error);
    throw error;
  }
};

// Add comment to shared wishlist item
export const addSharedWishlistItemComment = (itemId, text) => {
  return apiClient.post(`/shared-wishlist-items/${itemId}/comments`, { text });
};

export default apiClient;
