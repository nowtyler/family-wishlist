import React, { useState, useEffect } from 'react';
import { Calendar, Shirt, Ruler, Gift, Footprints, Asterisk, Hand, RulerDimensionLine, Info } from 'lucide-react';
import { updateFamilyMemberPreferences, updateSharedWishlistPreferences } from '../services/api';

const sizeOptions = {
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  kidsTshirt: ["Newborn", "0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "24M", "2T", "3T", "4T", "5T", "Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL"],
  hoodie: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  kidsHoodie: ["Newborn", "0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "24M", "2T", "3T", "4T", "5T", "Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL"],
  pants: {
    men: [
      "28x30", "28x32", "30x30", "30x32", "30x34",
      "31x30", "31x32", "31x34",
      "32x30", "32x32", "32x34", "32x36",
      "33x30", "33x32", "33x34", "33x36",
      "34x30", "34x32", "34x34", "34x36",
      "36x30", "36x32", "36x34", "36x36",
      "38x30", "38x32", "38x34", "38x36",
      "40x30", "40x32", "40x34",
      "42x30", "42x32", "42x34",
      "44x30", "44x32",
      "46x30", "46x32"
    ],
    women: ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
    kids: ["Newborn", "0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "24M", "2T", "3T", "4T", "5T", "Boys 8", "Boys 10", "Boys 12", "Boys 14", "Boys 16", "Girls 7", "Girls 8", "Girls 10", "Girls 12", "Girls 14", "Youth S", "Youth M", "Youth L"]
  },
  dress: [
    "XS", "S", "M", "L", "XL", "XXL",
    "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"
  ],
  kidsDress: ["Newborn", "0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "24M", "2T", "3T", "4T", "5T", "Girls 7", "Girls 8", "Girls 10", "Girls 12", "Girls 14"],
  shoes: {
    men: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15"],
    women: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
    kids: ["Newborn", "0", "Infant 1", "Infant 2", "Infant 3", "Toddler 4", "Toddler 5", "Toddler 6", "Toddler 7", "Toddler 8", "Toddler 9", "Toddler 10", "Little Kid 11", "Little Kid 12", "Little Kid 13", "Little Kid 1", "Little Kid 2", "Little Kid 3", "Big Kid 4", "Big Kid 5", "Big Kid 6", "Big Kid 7"]
  },
  wrist: ["5.5\"", "5.75\"", "6\"", "6.25\"", "6.5\"", "6.75\"", "7\"", "7.25\"", "7.5\"", "7.75\"", "8\"", "8.25\"", "8.5\"", "8.75\"", "9\""],
  neck: ["13-13.5", "14-14.5", "15-15.5", "16-16.5", "17-17.5", "18-18.5", "19-19.5"]
};

const buildInitialPreferences = (member) => ({
  tshirtSize: member?.preferences?.tshirtSize || '',
  hoodieSize: member?.preferences?.hoodieSize || '',
  pantsSize: member?.preferences?.pantsSize || '',
  dressSize: member?.preferences?.dressSize || '',
  shoeSize: member?.preferences?.shoeSize || '',
  wristSize: member?.preferences?.wristSize || '',
  neckSize: member?.preferences?.neckSize || '',
  additionalPreferences: member?.preferences?.additionalPreferences || '',
  showKidSizes: member?.preferences?.showKidSizes || false
});

const UserPreferencesPanel = ({
  member,
  isOwner,
  onUpdateSuccess = () => {},
  onClose,
  isActive = true,
  isSharedWishlist = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState(() => buildInitialPreferences(member));
  const [gender, setGender] = useState(member?.preferences?.gender || 'unspecified');
  const [showKidSizes, setShowKidSizes] = useState(member?.preferences?.showKidSizes || false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreferences(buildInitialPreferences(member));
    setGender(member?.preferences?.gender || 'unspecified');
    setShowKidSizes(member?.preferences?.showKidSizes || false);
  }, [member]);

  // Exit edit mode when the panel is dismissed
  useEffect(() => {
    if (!isActive && isEditing) {
      setIsEditing(false);
      setPreferences(buildInitialPreferences(member));
      setGender(member?.preferences?.gender || 'unspecified');
      setError('');
    }
  }, [isActive]);

  const getDaysUntilBirthday = (birthday) => {
    if (!birthday) return null;
    try {
      const [, month, day] = birthday.split('-').map(num => parseInt(num, 10));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
      if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(today.getFullYear() + 1);
      }
      const diffTime = Math.abs(birthdayThisYear.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { month, day, daysUntil: diffDays, date: birthdayThisYear };
    } catch (err) {
      console.error('Error calculating birthday:', err);
      return null;
    }
  };

  const formatBirthday = () => {
    const birthday = member?.birthday;
    if (!birthday) return null;
    const birthdayInfo = getDaysUntilBirthday(birthday);
    if (!birthdayInfo) return null;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      formatted: `${monthNames[birthdayInfo.month - 1]} ${birthdayInfo.day}`,
      daysUntil: birthdayInfo.daysUntil
    };
  };

  const handleEditSave = async () => {
    if (!isOwner) return;

    if (isEditing) {
      setIsLoading(true);
      setError('');
      try {
        const payload = { ...preferences, gender, showKidSizes };
        if (isSharedWishlist) {
          await updateSharedWishlistPreferences(member.id, payload);
        } else {
          await updateFamilyMemberPreferences(member.id, payload);
        }
        setIsEditing(false);
        setIsLoading(false);
        onUpdateSuccess();
      } catch (err) {
        console.error("Failed to update preferences:", err);
        setError("Failed to save preferences. Please try again.");
        setIsLoading(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPreferences(buildInitialPreferences(member));
    setGender(member?.preferences?.gender || 'unspecified');
    setShowKidSizes(member?.preferences?.showKidSizes || false);
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

  const SizeSelector = ({ label, icon, value, onChange, options }) => (
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
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      {/* Birthday pill + inline disclaimer */}
      {birthdayInfo && (
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2 py-1 rounded-full mb-2">
          <Calendar size={12} className="text-amber-500" />
          <span>Birthday: {birthdayInfo.formatted}</span>
          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-full text-[10px]">
            {birthdayInfo.daysUntil}d
          </span>
        </div>
      )}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1 mb-3">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <span>General size preferences. Add item-specific sizes on individual items.</span>
      </p>

      {/* Preferences Content */}
      {isEditing && (
        <div className="mb-3">
          <label className="text-sm font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1">
            <span>Gender (for size options)</span>
          </label>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <label className="flex items-center">
              <input type="radio" name="gender" value="men" checked={gender === 'men'} onChange={() => setGender('men')} className="mr-1" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Men's</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="gender" value="women" checked={gender === 'women'} onChange={() => setGender('women')} className="mr-1" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Women's</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="gender" value="unspecified" checked={gender === 'unspecified'} onChange={() => setGender('unspecified')} className="mr-1" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Not specified</span>
            </label>
            
            <label className="flex items-center ml-auto">
              <input type="checkbox" name="showKidSizes" checked={showKidSizes} onChange={(e) => setShowKidSizes(e.target.checked)} className="mr-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Kid/Young Adult Sizes</span>
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4">
        <SizeSelector label="T-Shirt Size" icon={<Shirt size={14} />} value={preferences.tshirtSize}
          onChange={(v) => setPreferences({ ...preferences, tshirtSize: v })} options={showKidSizes ? [...sizeOptions.kidsTshirt, ...sizeOptions.tshirt] : sizeOptions.tshirt} />
        <SizeSelector label="Hoodie Size" icon={<Shirt size={14} />} value={preferences.hoodieSize}
          onChange={(v) => setPreferences({ ...preferences, hoodieSize: v })} options={showKidSizes ? [...sizeOptions.kidsHoodie, ...sizeOptions.hoodie] : sizeOptions.hoodie} />
        <SizeSelector label="Pants Size" icon={<Ruler size={14} />} value={preferences.pantsSize}
          onChange={(v) => setPreferences({ ...preferences, pantsSize: v })}
          options={showKidSizes ? [...sizeOptions.pants.kids, ...(gender === 'women' ? sizeOptions.pants.women : sizeOptions.pants.men)] : (gender === 'women' ? sizeOptions.pants.women : sizeOptions.pants.men)} />
        {gender === 'women' && (
          <SizeSelector label="Dress Size" icon={<Gift size={14} />} value={preferences.dressSize}
            onChange={(v) => setPreferences({ ...preferences, dressSize: v })} options={showKidSizes ? [...sizeOptions.kidsDress, ...sizeOptions.dress] : sizeOptions.dress} />
        )}
        <SizeSelector label="Shoe Size" icon={<Footprints size={14} />} value={preferences.shoeSize}
          onChange={(v) => setPreferences({ ...preferences, shoeSize: v })}
          options={showKidSizes ? [...sizeOptions.shoes.kids, ...(gender === 'women' ? sizeOptions.shoes.women : sizeOptions.shoes.men)] : (gender === 'women' ? sizeOptions.shoes.women : sizeOptions.shoes.men)} />
        <SizeSelector label="Wrist Size" icon={<Hand size={14} />} value={preferences.wristSize}
          onChange={(v) => setPreferences({ ...preferences, wristSize: v })} options={sizeOptions.wrist} />
        <SizeSelector label="Neck Size" icon={<RulerDimensionLine size={14} />} value={preferences.neckSize}
          onChange={(v) => setPreferences({ ...preferences, neckSize: v })} options={sizeOptions.neck} />
      </div>

      <div className="mt-3">
        <label className="text-sm font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300 mb-1">
          <Asterisk size={14} />
          <span>Additional Preferences</span>
        </label>
        {isEditing ? (
          <textarea
            value={preferences.additionalPreferences || ''}
            onChange={(e) => setPreferences({ ...preferences, additionalPreferences: e.target.value })}
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
            {isOwner ? "You haven't set any size preferences yet." : "No size preferences have been set."}
          </p>
          {isOwner && (
            <button onClick={handleEditSave} className="mt-2 text-sm text-blue-500 hover:text-blue-700">
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

      {/* Action buttons — only render when there's something to show */}
      {(isEditing || isOwner || onClose) && (
        <div className="sticky bottom-0 left-0 right-0 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700 bg-transparent pb-2">
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {isOwner && (
                <button
                  onClick={handleEditSave}
                  className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg text-white font-medium transition-colors duration-200"
                >
                  Edit
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className={`${isOwner ? 'flex-1' : 'w-full'} py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-medium transition-colors duration-200`}
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserPreferencesPanel;
