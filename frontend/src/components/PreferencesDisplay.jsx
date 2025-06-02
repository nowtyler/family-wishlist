import React from 'react';
import { Ruler } from 'lucide-react';

/**
 * Component to display a user's size preferences in a read-only format
 */
const PreferencesDisplay = ({ preferences, className = '' }) => {
  if (!preferences) return null;

  // Filter out empty preferences
  const hasPreferences = Object.values(preferences).some(value => value && value.trim() !== '');
  
  if (!hasPreferences) return null;
  
  const PreferenceBadge = ({ label, value }) => {
    if (!value || value.trim() === '') return null;
    
    return (
      <div className="size-preference-badge">
        <span className="font-medium mr-1">{label}:</span>
        <span>{value}</span>
      </div>
    );
  };
  
  return (
    <div className={`size-preferences-container p-3 mt-2 ${className}`}>
      <div className="flex items-center mb-2">
        <Ruler size={16} className="mr-2 text-blue-500 dark:text-blue-400" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Size Preferences
        </h4>
      </div>
      
      <div className="flex flex-wrap">
        <PreferenceBadge label="T-shirt" value={preferences.tshirtSize} />
        <PreferenceBadge label="Hoodie" value={preferences.hoodieSize} />
        <PreferenceBadge label="Pants" value={preferences.pantsSize} />
        <PreferenceBadge label="Dress" value={preferences.dressSize} />
        <PreferenceBadge label="Shoes" value={preferences.shoeSize} />
        <PreferenceBadge label="Wrist" value={preferences.wristSize} />
        <PreferenceBadge label="Neck" value={preferences.neckSize} />
      </div>
      
      {preferences.additionalPreferences && preferences.additionalPreferences.trim() !== '' && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Additional preferences:</span> {preferences.additionalPreferences}
        </div>
      )}
    </div>
  );
};

export default PreferencesDisplay;
