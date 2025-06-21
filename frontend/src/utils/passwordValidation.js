/**
 * Validates password strength according to the same rules as the backend
 * @param {string} password - The password to validate
 * @returns {object} - Object with isValid boolean and error message if invalid
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long"
    };
  }
  
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must include at least one uppercase letter"
    };
  }
  
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: "Password must include at least one lowercase letter"
    };
  }
  
  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: "Password must include at least one number"
    };
  }
  
  return {
    isValid: true,
    error: null
  };
};

/**
 * Validates that two passwords match
 * @param {string} password - The first password
 * @param {string} confirmPassword - The confirmation password
 * @returns {object} - Object with isValid boolean and error message if invalid
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return {
      isValid: false,
      error: "Passwords do not match"
    };
  }
  
  return {
    isValid: true,
    error: null
  };
}; 