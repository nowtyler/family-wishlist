/**
 * Utility functions for date and birthday calculations
 */

/**
 * Calculate the days until the next birthday
 * @param {string} birthday - Birthday in YYYY-MM-DD format
 * @returns {object|null} Birthday information including days until next birthday
 */
export const getDaysUntilBirthday = (birthday) => {
  if (!birthday) return null;
  
  try {
    // Parse the birthday (format: YYYY-MM-DD)
    const [year, month, day] = birthday.split('-').map(num => parseInt(num, 10));
    
    // Create date objects for today and the next birthday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create this year's birthday
    const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
    
    // If birthday has already passed this year, get next year's birthday
    if (birthdayThisYear < today) {
      birthdayThisYear.setFullYear(today.getFullYear() + 1);
    }
    
    // Calculate difference in days
    const diffTime = Math.abs(birthdayThisYear - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      month,
      day,
      daysUntil: diffDays,
      date: birthdayThisYear,
      formattedDate: formatDate(birthdayThisYear)
    };
  } catch (err) {
    console.error('Error calculating birthday:', err);
    return null;
  }
};

/**
 * Format a date to a user-friendly string
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

/**
 * Get a friendly display text for days until event
 * @param {number} daysUntil - Number of days until event
 * @param {Date} eventDate - The event date
 * @returns {string} Display text
 */
export const getCountdownDisplay = (daysUntil, eventDate) => {
  if (!eventDate) return '';
  
  if (daysUntil === 0) {
    return "is TODAY!";
  } else if (daysUntil === 1) {
    return "is TOMORROW!";
  } else if (daysUntil < 0) {
    return "has passed.";
  } else {
    return `is in ${daysUntil} days (${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }
};
