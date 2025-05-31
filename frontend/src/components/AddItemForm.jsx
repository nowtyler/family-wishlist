// AddItemForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fetchProductDetailsFromUrl, getWishlistItems } from '../services/api';
import { X, Link, Loader, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

// Add priority mapping
const PRIORITY_MAP = {
  'High': 2,
  'Medium': 1,
  'Low': 0
};

const MAX_TITLE_LENGTH = 200;

function AddItemForm({ wishlistId, onAddItem, onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    image_url: '',
    priority: 'Medium',
    price: ''
  });
  const [error, setError] = useState('');
  const [isAddMode, setIsAddMode] = useState(true);
  const [urlImportVisible, setUrlImportVisible] = useState(true);
  const [urlToImport, setUrlToImport] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [existingItems, setExistingItems] = useState([]);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const [isDuplicateTitle, setIsDuplicateTitle] = useState(false);
  const formRef = useRef(null);
  const submitButtonRef = useRef(null);

  // Fetch existing items to check for duplicate titles
  useEffect(() => {
    const fetchExistingItems = async () => {
      if (!wishlistId) return;
      
      try {
        setIsFetchingItems(true);
        const response = await getWishlistItems(wishlistId);
        if (response && response.data) {
          setExistingItems(response.data);
        }
      } catch (err) {
        console.error('Error fetching existing items:', err);
      } finally {
        setIsFetchingItems(false);
      }
    };

    fetchExistingItems();
  }, [wishlistId]);

  // Check for duplicate titles when form data changes
  useEffect(() => {
    if (!formData.title.trim()) {
      setIsDuplicateTitle(false);
      return;
    }

    const normalizedTitle = formData.title.trim().toLowerCase();
    const isDuplicate = existingItems.some(item => 
      item.title.toLowerCase() === normalizedTitle
    );
    
    setIsDuplicateTitle(isDuplicate);
  }, [formData.title, existingItems]);

  // Scroll to the submit button when import is successful or when duplicates are detected
  useEffect(() => {
    if (importSuccess || isDuplicateTitle) {
      // Short timeout to ensure DOM is updated
      setTimeout(() => {
        // Scroll to the bottom of the form to make submit button visible
        if (formRef.current) {
          // Get the form's bottom position
          const formBottom = formRef.current.getBoundingClientRect().bottom;
          const viewportHeight = window.innerHeight;
          
          // If the form bottom is below viewport, scroll to show the submit button
          if (formBottom > viewportHeight) {
            window.scrollTo({
              top: window.scrollY + (formBottom - viewportHeight) + 100, // Add padding
              behavior: 'smooth'
            });
            
            // Highlight the button area for better visibility
            if (submitButtonRef.current) {
              submitButtonRef.current.classList.add('highlight-pulse');
              setTimeout(() => {
                if (submitButtonRef.current) {
                  submitButtonRef.current.classList.remove('highlight-pulse');
                }
              }, 1500);
            }
          }
        }
      }, 300);
    }
  }, [importSuccess, isDuplicateTitle]);

  // Add a function to truncate titles
  const truncateTitle = (title) => {
    return title && title.length > MAX_TITLE_LENGTH 
      ? title.substring(0, MAX_TITLE_LENGTH) 
      : title;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Basic validation
    if (!formData.title?.trim()) {
      setError('Title is required');
      return;
    }

    // Modify the duplicate check for mobile URL imports
    // Only check for exact duplicates - allow similar titles
    const exactDuplicateOnly = importSuccess && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isDuplicateTitle && !exactDuplicateOnly) {
      setError('An item with this title already exists in your wishlist');
      return;
    }

    // Convert form data to API format
    const apiData = {
      ...formData,
      title: truncateTitle(formData.title.trim()), // Truncate title to 200 chars
      priority: PRIORITY_MAP[formData.priority],
      link: formData.link || null,
      image_url: formData.image_url || null,
      description: formData.description || null,
      price: formData.price ? parseFloat(formData.price) : null  // Pass raw dollar amount
    };

    try {
      // If this is a mobile import, add a timestamp to the title to ensure uniqueness
      if (exactDuplicateOnly) {
        const timestampSuffix = ` (${new Date().toISOString().substring(11, 19)})`;
        apiData.title = formData.title.trim() + timestampSuffix;
      }
      
      await onAddItem(apiData);
      onClose();
    } catch (err) {
      console.error('Add item error:', err);
      const errorDetail = err.response?.data?.detail;
      if (errorDetail) {
        const errorMessage = Array.isArray(errorDetail) 
          ? errorDetail.map(d => d.msg || d).join(', ')
          : errorDetail;
        setError(errorMessage);
      } else {
        setError('Failed to add item. Please try again.');
      }
    }
  };

  const handleImportUrl = async () => {
    if (!urlToImport.trim()) {
      setError('Please enter a URL to import');
      return;
    }

    setError('');
    setIsImporting(true);
    
    try {
      const productDetails = await fetchProductDetailsFromUrl(urlToImport);
      
      // Check if we got an error response
      if (productDetails.error) {
        setError(productDetails.message || productDetails.error);
        
        // Still let the user continue with manual entry
        if (productDetails.url) {
          setFormData({
            ...formData,
            link: productDetails.url
          });
        }
        
        // Show manual entry form
        setIsAddMode(false);
        setShowAdvancedFields(true);
      } else {
        // Update form with fetched data and truncate title if needed
        const updatedFormData = {
          ...formData,
          title: truncateTitle(productDetails.title || ''), // Truncate imported title
          description: productDetails.description || formData.description,
          link: productDetails.url || urlToImport,
          image_url: productDetails.image_url || '',
          price: productDetails.price ? productDetails.price.toString() : ''
        };
        
        setFormData(updatedFormData);
        setImportSuccess(true);
        setIsAddMode(false);
        setUrlImportVisible(false);
        setShowAdvancedFields(true);
        
        // Check for duplicates explicitly after import
        const normalizedTitle = updatedFormData.title.trim().toLowerCase();
        const isDuplicate = existingItems.some(item => 
          item.title.toLowerCase() === normalizedTitle
        );
        setIsDuplicateTitle(isDuplicate);
      }
    } catch (err) {
      console.error('URL import error:', err);
      setError('Failed to import product details. Please try entering them manually.');
      // Still let the user continue with manual entry
      setFormData({
        ...formData,
        link: urlToImport
      });
      setShowAdvancedFields(true);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleAdvancedFields = () => {
    setShowAdvancedFields(!showAdvancedFields);
  };

  const handleSwitchToManualEntry = () => {
    setIsAddMode(false);
    setUrlImportVisible(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl mx-auto relative"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 pr-8">Add New Item</h2>
        {/* Remove the X button from here */}
      </div>

      {urlImportVisible && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center">
            <Link size={18} className="mr-2" />
            Import from URL
          </h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
            Paste a product URL to automatically import details
          </p>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="url"
              value={urlToImport}
              onChange={(e) => setUrlToImport(e.target.value)}
              placeholder="https://www.example.com/product"
              className="flex-1 px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isImporting}
            />
            <button
              onClick={handleImportUrl}
              disabled={isImporting}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md flex items-center justify-center"
              aria-label="Import from URL"
            >
              {isImporting ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              <span className="ml-2 sm:hidden">Import</span>
            </button>
          </div>
          
          {!isImporting && (
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSwitchToManualEntry}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Skip and enter manually
              </button>
            </div>
          )}
        </div>
      )}

      {importSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 mb-4 flex items-center">
          <div className="bg-green-100 dark:bg-green-800 rounded-full p-1 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 dark:text-green-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Product details imported successfully! Review and customize below.
          </p>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
            <span className="text-xs text-gray-500 ml-1">
              ({formData.title ? formData.title.length : 0}/{MAX_TITLE_LENGTH})
            </span>
          </label>
          <input
            type="text"
            required
            maxLength={MAX_TITLE_LENGTH}
            className={`w-full px-4 py-2 border ${isDuplicateTitle ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
            value={formData.title}
            onChange={(e) => {
              const newTitle = e.target.value.substring(0, MAX_TITLE_LENGTH);
              setFormData({ ...formData, title: newTitle });
            }}
          />
          {isDuplicateTitle && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              An item with this title already exists in your wishlist
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Price
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={formData.price}
            onChange={(e) => {
              const value = e.target.value;
              setFormData({ ...formData, price: value ? value : '' });
            }}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>

        <button
          type="button"
          onClick={toggleAdvancedFields}
          className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {showAdvancedFields ? (
            <>
              <ChevronUp size={16} className="mr-1" />
              Hide additional details
            </>
          ) : (
            <>
              <ChevronDown size={16} className="mr-1" />
              Show additional details
            </>
          )}
        </button>

        {showAdvancedFields && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[100px]"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Item URL
              </label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              {formData.image_url && (
                <div className="mt-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Image Preview:</p>
                  <img 
                    src={formData.image_url}
                    alt="Preview" 
                    className="max-h-32 max-w-full object-contain" 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yNCAxMmMwIDYuNjIzLTUuMzc3IDEyLTEyIDEycy0xMi01LjM3Ny0xMi0xMiA1LjM3Ny0xMiAxMi0xMiAxMiA1LjM3NyAxMiAxMnptLTExIDVoLTJ2LTdoMnY3em0wLThoLTJ2LTJoMnYyeiIvPjwvc3ZnPg==';
                      e.target.alt = 'Error loading image';
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Fixed button placement with ref for scrolling */}
        <div 
          ref={submitButtonRef}
          className="sticky bottom-0 flex justify-end space-x-3 pt-4 border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pb-2"
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 border border-transparent rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isDuplicateTitle && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 ${
              isDuplicateTitle && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-primary dark:bg-primary-600 hover:bg-primary-dark dark:hover:bg-primary-