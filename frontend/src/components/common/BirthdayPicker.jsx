import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from 'lucide-react';

const BirthdayPicker = ({ value, onChange, className = "", disabled = false }) => {
  // Parse the YYYY-MM-DD string to a Date object
  const parseDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    // Use UTC to avoid timezone issues
    return new Date(Date.UTC(year, month - 1, day));
  };

  // Format Date object to YYYY-MM-DD string
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className={`relative ${className}`}>
      <DatePicker
        selected={parseDate(value)}
        onChange={(date) => onChange(formatDate(date))}
        dateFormat="MMMM d"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        yearDropdownItemNumber={100}
        scrollableYearDropdown
        disabled={disabled}
        placeholderText="Select birthday"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        customInput={
          <div className="relative">
            <input
              type="text"
              className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
          </div>
        }
      />
    </div>
  );
};

export default BirthdayPicker; 