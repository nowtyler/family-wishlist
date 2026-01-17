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
    const diffTime = Math.abs(birthdayThisYear.getTime() - today.getTime());
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
 * Format a date to EST timezone for admin displays
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date string in EST timezone
 */
export const formatDateEST = (date) => {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format in EST timezone
    return dateObj.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (err) {
    console.error('Error formatting date in EST:', err);
    return 'Invalid Date';
  }
};

/**
 * Format a date to a user-friendly string in EST timezone
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDateESTFriendly = (date) => {
  if (!date) return 'Never';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format in EST timezone with friendly format
    return dateObj.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (err) {
    console.error('Error formatting date in EST:', err);
    return 'Invalid Date';
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

/**
 * Calculate information about the next Christmas date
 * @returns {object} Christmas information including days until next Christmas
 */
export const getChristmasInfo = () => {
  // Get the current date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Christmas is on December 25
  const christmasMonth = 12;
  const christmasDay = 25;
  
  // Create this year's Christmas date
  const christmasThisYear = new Date(today.getFullYear(), christmasMonth - 1, christmasDay);
  
  // If Christmas has already passed this year, get next year's Christmas
  if (christmasThisYear < today) {
    christmasThisYear.setFullYear(today.getFullYear() + 1);
  }
  
  // Calculate difference in days
  const diffTime = Math.abs(christmasThisYear.getTime() - today.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    name: "Christmas",
    month: christmasMonth,
    day: christmasDay,
    daysUntil: diffDays,
    date: christmasThisYear,
    formattedDate: formatDate(christmasThisYear)
  };
};

/**
 * Get all upcoming events (birthdays and Christmas) ordered by date
 * @param {Array} familyMembers - Array of family members
 * @returns {Array} Sorted array of upcoming events
 */
export const getUpcomingEvents = (familyMembers) => {
  const events = [];
  
  // Add Christmas to events
  const christmasInfo = getChristmasInfo();
  if (christmasInfo) {
    events.push({
      name: "Christmas",
      daysUntil: christmasInfo.daysUntil,
      date: christmasInfo.date
    });
  }
  
  // Add all family member birthdays
  if (Array.isArray(familyMembers)) {
    familyMembers.forEach(member => {
      if (member.birthday && !member.name.toLowerCase().includes('admin')) {
        const birthdayInfo = getDaysUntilBirthday(member.birthday);
        if (birthdayInfo) {
          events.push({
            name: `${member.name}'s Birthday`,
            daysUntil: birthdayInfo.daysUntil,
            date: birthdayInfo.date
          });
        }
      }
    });
  }
  
  // Sort events by days until (closest first)
  events.sort((a, b) => a.daysUntil - b.daysUntil);
  
  return events;
};
