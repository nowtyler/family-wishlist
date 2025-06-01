import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar, TShirt, Ruler, Pencil, Save, X, Gift } from 'lucide-react';
import { updateFamilyMemberPreferences } from '../services/api';

const sizeOptions = {
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  hoodie: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  pants: {
    men: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "38", "40", "42", "44", "46"],
    women: ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"]
  },
  dress: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
  shoes: {
    men: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13", "14", "15"],
    women: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12"]
  },
  wrist: ["5.5\"", "6\"", "6.5\"", "7\"", "7.5\"", "8\"", "8.5\"", "9\""],
  neck: ["13-13.5", "14-14.5", "15-15.5", "16-16.5", "17-17.5", "18-18.5", "19-19.5"]
};

const UserPreferencesDropdown = ({ member, isOwner, currentUserId, onUpdateSuccess = () => {} }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState({
    tshirtSize: member?.preferences?.tshirtSize || '',
    hoodieSize: member?.preferences?.hoodieSize || '',
    pantsSize: member?.preferences?.pantsSize || '',
    dressSize: member?.preferences?.dressSize || '',
    shoeSize: member?.preferences?.shoeSize || '',
    wristSize: member?.preferences?.wristSize || '',
    neckSize: member?.preferences?.neckSize || '',
    additionalPreferences: member?.preferences?.additionalPreferences || ''
  });
  const [gender, setGender] = useState(member?.preferences?.gender || 'unspecified');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        if (isEditing) {
          setIsEditing(false);
          // Reset form state to current preferences
          setPreferences({
            tshirtSize: member?.preferences?.tshirtSize || '',
            hoodieSize: member?.preferences?.hoodieSize || '',
            pantsSize: member?.preferences?.pantsSize || '',
            dressSize: member?.preferences?.dressSize || '',
            shoeSize: member?.preferences?.shoeSize || '',
            wristSize: member?.preferences?.wristSize || '',
            neckSize: member?.preferences?.neckSize || '',
            additionalPreferences: member?.preferences?.additionalPreferences || ''
          });
          setGender(member?.preferences?.gender || 'unspecified');
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, member?.preferences]);

  // Calculate days until birthday
  const getDaysUntilBirthday = (birthday) => {
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
        date: birthdayThisYear
      };
    } catch (err) {
      console.error('Error calculating birthday:', err);
      return null;
    }
  };

  // Format birthday for display
  const formatBirthday = () => {
    const birthday = member?.birthday;
    if (!birthday) return null;

    const birthdayInfo = getDaysUntilBirthday(birthday);
    if (!birthdayInfo) return null;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    return {
      formatted: `${monthNames[birthdayInfo.month - 1]} ${birthdayInfo.day}`,
      daysUntil: birthdayInfo.daysUntil
    };
  };

  const handleEditSave = async () => {
    if (!isOwner) return;
    
    if (isEditing) {
      // Save changes
      setIsLoading(true);
      setError('');
      
      try {
        // Call API to update preferences
        await updateFamilyMemberPreferences(member.id, {
          ...preferences,
          gender
        });
        
        // Update was successful - exit edit mode
        setIsEditing(false);
        setIsLoading(false);
        onUpdateSuccess();
      } catch (err) {
        console.error("Failed to update preferences:", err);
        setError("Failed to save preferences. Please try again.");
        setIsLoading(false);
      }
    } else {
      // Enter edit mode
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    // Exit edit mode without saving
    setIsEditing(false);
    // Reset form state to current preferences
    setPreferences({
      tshirtSize: member?.preferences?.tshirtSize || '',
      hoodieSize: member?.preferences?.hoodieSize || '',
      pantsSize: member?.preferences?.pantsSize || '',
      dressSize: member?.preferences?.dressSize || '',
      shoeSize: member?.preferences?.shoeSize || '',
      wristSize: member?.preferences?.wristSize || '',
      neckSize: member?.preferences?.neckSize || '',
      additionalPreferences: member?.preferences?.additionalPreferences || ''
    });
    setGender(member?.preferences?.gender || 'unspecified');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    // Exit edit mode when closing dropdown
    if (isDropdownOpen && isEditing) {
      setIsEditing(false);
    }
  };

  const hasPreferences = !!member?.preferences && (
    member.preferences.tshirtSize || 
    member.preferences.hoodieSize || 
    member.preferences.pantsSize ||
    member.preferences.dressSize ||
    member.preferences.shoeSize ||
    member.preferences.wristSize ||
    member.preferences.neckSize ||
    member.preferences.additionalPreferences
  );

  const birthdayInfo = formatBirthday();

  // Helper to render size selector
  const SizeSelector = ({ label, icon, value, onChange, options }) => {
    return (
      <div className="mb-3">
        <label className="text-sm font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1">
          {icon}
          <span>{label}</span>
        </label>
        <select 
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={!isEditing}
        >
          <option value="">Not specified</option>
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 text-gray-700 dark:text-gray-300 rounded-full text-sm transition-colors"
        title="User preferences"
      >
        <TShirt size={14} className="text-indigo-500 dark:text-indigo-400" />
        <span>Sizes & Preferences</span>
        <ChevronDown 
          size={14} 
          className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden z-20"
          >
            {/* Header with Birthday Info */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {member.name}'s Preferences
                </h3>
                {isOwner && (
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleCancel} 
                          className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <X size={16} />
                        </button>
                        <button 
                          onClick={handleEditSave} 
                          className="p-1 text-emerald-500 hover:text-emerald-700"
                          disabled={isLoading}
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={handleEditSave} 
                        className="p-1 text-blue-500 hover:text-blue-700"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {birthdayInfo && (
                <div className="flex items-center gap-1.5 mt-2 text-gray-700 dark:text-gray-300 text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded-md">
                  <Calendar size={14} className="text-amber-500" />
                  <span>Birthday: {birthdayInfo.formatted}</span>
                  <span className="ml-auto px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-full text-xs">
                    {birthdayInfo.daysUntil} {birthdayInfo.daysUntil === 1 ? 'day away' : 'days away'}
                  </span>
                </div>
              )}
            </div>

            {/* Preferences Content */}
            <div className="p-4">
              {isEditing && (
                <div className="mb-3">
                  <label className="text-sm font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1">
                    <span>Gender (for size options)</span>
                  </label>
                  <div className="flex items-center space-x-4 mb-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value="men"
                        checked={gender === 'men'}
                        onChange={() => setGender('men')}
                        className="mr-1"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Men's</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value="women"
                        checked={gender === 'women'}
                        onChange={() => setGender('women')}
                        className="mr-1"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Women's</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value="unspecified"
                        checked={gender === 'unspecified'}
                        onChange={() => setGender('unspecified')}
                        className="mr-1"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Not specified</span>
                    </label>
                  </div>
                </div>
              )}
              
              {/* Size preference fields */}
              <div className="grid grid-cols-2 gap-x-4">
                <SizeSelector
                  label="T-Shirt Size"
                  icon={<TShirt size={14} />}
                  value={preferences.tshirtSize}
                  onChange={(value) => setPreferences({...preferences, tshirtSize: value})}
                  options={sizeOptions.tshirt}
                />
                
                <SizeSelector
                  label="Hoodie/Jacket Size"
                  icon={<TShirt size={14} />}
                  value={preferences.hoodieSize}
                  onChange={(value) => setPreferences({...preferences, hoodieSize: value})}
                  options={sizeOptions.hoodie}
                />
                
                <SizeSelector
                  label="Pants Size"
                  icon={<Ruler size={14} />}
                  value={preferences.pantsSize}
                  onChange={(value) => setPreferences({...preferences, pantsSize: value})}
                  options={gender === 'women' ? sizeOptions.pants.women : sizeOptions.pants.men}
                />
                
                {gender === 'women' && (
                  <SizeSelector
                    label="Dress Size"
                    icon={<Gift size={14} />}
                    value={preferences.dressSize}
                    onChange={(value) => setPreferences({...preferences, dressSize: value})}
                    options={sizeOptions.dress}
                  />
                )}
                
                <SizeSelector
                  label="Shoe Size"
                  icon={<Gift size={14} />}
                  value={preferences.shoeSize}
                  onChange={(value) => setPreferences({...preferences, shoeSize: value})}
                  options={gender === 'women' ? sizeOptions.shoes.women : sizeOptions.shoes.men}
                />
                
                <SizeSelector
                  label="Wrist Size"
                  icon={<Ruler size={14} />}
                  value={preferences.wristSize}
                  onChange={(value) => setPreferences({...preferences, wristSize: value})}
                  options={sizeOptions.wrist}
                />
                
                <SizeSelector
                  label="Neck Size"
                  icon={<Ruler size={14} />}
                  value={preferences.neckSize}
                  onChange={(value) => setPreferences({...preferences, neckSize: value})}
                  options={sizeOptions.neck}
                />
              </div>
              
              {/* Additional preferences text area */}
              <div className="mt-3">
                <label className="text-sm font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1">
                  <Gift size={14} />
                  <span>Additional Preferences</span>
                </label>
                {isEditing ? (
                  <textarea
                    value={preferences.additionalPreferences || ''}
                    onChange={(e) => setPreferences({...preferences, additionalPreferences: e.target.value})}
                    placeholder="Colors, styles, materials, etc."
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                  />
                ) : preferences.additionalPreferences ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                    {preferences.additionalPreferences}
                  </p>
                ) : (
                  <p className="text-sm italic text-gray-500 dark:text-gray-400">No additional preferences specified.</p>
                )}
              </div>
              
              {!hasPreferences && !isEditing && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isOwner ? 'You haven\'t set any size preferences yet.' : 'No size preferences have been set.'}
                  </p>
                  {isOwner && (
                    <button
                      onClick={handleEditSave}
                      className="mt-2 text-sm text-blue-500 hover:text-blue-700"
                    >
                      Add your preferences
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-3 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300 rounded-md">
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserPreferencesDropdown;
