import React, { useState, useEffect } from 'react';
import { ExternalLink, Plus, Edit2, Trash2, Check, X, Info } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import {
  getExternalWishlists,
  createExternalWishlist,
  updateExternalWishlist,
  deleteExternalWishlist,
  getSharedWishlistExternalWishlists,
  createSharedWishlistExternalWishlist,
} from '../services/api';

const ExternalWishlistsPanel = ({ member, sharedWishlist, isActive = true }) => {
  const [wishlists, setWishlists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState(0);
  const minFetchInterval = 2000;

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '' });
  const [urlError, setUrlError] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  const { selectedUser } = useAppContext();

  const isAdmin = selectedUser?.name?.toLowerCase() === 'admin';
  const isSharedMode = !!sharedWishlist;
  const canEdit = isAdmin || (isSharedMode
    ? sharedWishlist.owners?.some(o => o.id === selectedUser?.id)
    : selectedUser?.id === member?.id);

  useEffect(() => {
    if (isActive && (member?.id || sharedWishlist?.id)) {
      fetchWishlists();
    }
  }, [isActive, member?.id, sharedWishlist?.id]);

  const fetchWishlists = async (force = false) => {
    if (!member?.id && !sharedWishlist?.id) return;

    const now = Date.now();
    if (!force && now - lastFetchTimestamp < minFetchInterval) {
      return;
    }

    setIsLoading(true);
    setError('');
    setLastFetchTimestamp(now);

    try {
      const response = isSharedMode
        ? await getSharedWishlistExternalWishlists(sharedWishlist.id)
        : await getExternalWishlists(member.id);
      setWishlists(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before trying again.');
      } else {
        setError('Failed to load external wishlists');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatEtsyUrl = (url) => {
    if (!url) return { formattedUrl: '', isValid: false, error: null };

    try {
      let formattedUrl = url;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const urlObj = new URL(formattedUrl);

      if (urlObj.hostname.includes('etsy.com')) {
        const pathParts = urlObj.pathname.split('/').filter(part => part);

        if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'people') {
          return {
            formattedUrl: `https://www.etsy.com/people/${pathParts[1]}`,
            isValid: true,
            error: null,
          };
        } else if (pathParts.length >= 1 && pathParts[0].toLowerCase() === 'shop') {
          return {
            formattedUrl,
            isValid: false,
            error: "For Etsy, please use the profile URL format: https://www.etsy.com/people/USERID",
          };
        } else {
          return {
            formattedUrl,
            isValid: false,
            error: "Etsy URLs should follow the format: https://www.etsy.com/people/USERID",
          };
        }
      }

      return { formattedUrl, isValid: true, error: null };
    } catch (err) {
      if (err.code === "ERR_INVALID_URL" || err.message?.includes("Invalid URL")) {
        try {
          const fixedUrl = `https://${url}`;
          new URL(fixedUrl);
          return { formattedUrl: fixedUrl, isValid: true, error: null };
        } catch (secondErr) {
          return {
            formattedUrl: url,
            isValid: false,
            error: "Invalid URL format. Please enter a valid URL.",
          };
        }
      }
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, url }));

    if (urlError) setUrlError('');

    if (url.trim()) {
      if (url.toLowerCase().includes('etsy.com')) {
        const { error: formatError } = formatEtsyUrl(url);
        if (formatError) {
          setUrlError(formatError);
        }
      } else if (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.')) {
        setUrlError('__info__: URL will be automatically prefixed with https:// when saved');
      }
    }
  };

  const handleAddNew = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Both name and URL are required');
      return;
    }

    const { formattedUrl, isValid, error: formatError } = formatEtsyUrl(formData.url);

    if (!isValid) {
      setUrlError(formatError || "Invalid URL format");
      return;
    }

    setIsLoading(true);
    setError('');
    setUrlError('');

    try {
      const createData = { name: formData.name.trim(), url: formattedUrl };
      if (isSharedMode) {
        await createSharedWishlistExternalWishlist(sharedWishlist.id, createData);
      } else {
        await createExternalWishlist(member.id, createData);
      }

      setTimeout(async () => {
        await fetchWishlists(true);
        setFormData({ name: '', url: '' });
        setIsAddingNew(false);
      }, 300);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before trying again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to add wishlist');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Both name and URL are required');
      return;
    }

    const { formattedUrl, isValid, error: formatError } = formatEtsyUrl(formData.url);

    if (!isValid) {
      setUrlError(formatError || "Invalid URL format");
      return;
    }

    setIsLoading(true);
    setError('');
    setUrlError('');

    try {
      await updateExternalWishlist(id, {
        name: formData.name.trim(),
        url: formattedUrl,
      });

      setTimeout(async () => {
        await fetchWishlists(true);
        setEditingId(null);
      }, 300);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before trying again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to update wishlist');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setIsLoading(true);
    setError('');

    try {
      await deleteExternalWishlist(id);

      setTimeout(async () => {
        await fetchWishlists(true);
        setShowConfirmDelete(null);
      }, 300);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before trying again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to delete wishlist');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (wishlist) => {
    setFormData({ name: wishlist.name, url: wishlist.url });
    setEditingId(wishlist.id);
    setError('');
    setUrlError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({ name: '', url: '' });
    setError('');
    setUrlError('');
  };

  return (
    <div>
      {isLoading && (
        <div className="py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
          {error}
        </div>
      )}

      {canEdit && !isAddingNew && !editingId && (
        <button
          onClick={() => {
            setIsAddingNew(true);
            setFormData({ name: '', url: '' });
          }}
          className="w-full flex items-center justify-center gap-2 p-3 mb-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <Plus size={16} />
          <span>Add External Wishlist</span>
        </button>
      )}

      {isAddingNew && canEdit && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md mb-4 bg-gray-50 dark:bg-gray-700/50">
          <h4 className="font-medium text-sm mb-2 text-gray-700 dark:text-gray-300">Add External Wishlist</h4>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name (e.g., Amazon, Etsy)"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div>
              <input
                type="url"
                value={formData.url}
                onChange={handleUrlChange}
                placeholder="URL (e.g., amazon.com or https://amazon.com/...)"
                className={`w-full px-3 py-2 text-sm border ${urlError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              />
              {urlError && (
                <p className={`text-xs mt-1 ${urlError.startsWith('__info__:') ? 'text-blue-500 dark:text-blue-400' : 'text-red-500'}`}>
                  {urlError.startsWith('__info__:') ? urlError.substring(9) : urlError}
                </p>
              )}
              {formData.url.toLowerCase().includes('etsy.com') && !urlError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Etsy tip: Use your "people" URL https://www.etsy.com/people/USERNAME
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNew}
              disabled={isLoading || (urlError && !urlError.startsWith('__info__:'))}
              className={`px-3 py-1 text-sm text-white rounded-md ${(urlError && !urlError.startsWith('__info__:')) || isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
            >
              Add Wishlist
            </button>
          </div>
        </div>
      )}

      {!isLoading && (!wishlists || wishlists.length === 0) ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <span>No external wishlists {canEdit ? 'added yet.' : 'found.'}</span>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {Array.isArray(wishlists) && wishlists.map(wishlist => (
            <div
              key={wishlist.id}
              className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
            >
              {editingId === wishlist.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  />
                  <div>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={handleUrlChange}
                      className={`w-full px-3 py-2 text-sm border ${urlError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'} rounded-md bg-white dark:bg-gray-700`}
                    />
                    {urlError && (
                      <p className={`text-xs mt-1 ${urlError.startsWith('__info__:') ? 'text-blue-500 dark:text-blue-400' : 'text-red-500'}`}>
                        {urlError.startsWith('__info__:') ? urlError.substring(9) : urlError}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => handleUpdate(wishlist.id)}
                      className={`p-1 ${urlError && !urlError.startsWith('__info__:') ? 'text-gray-400 cursor-not-allowed' : 'text-green-500 hover:text-green-700'}`}
                      title="Save"
                      disabled={urlError && !urlError.startsWith('__info__:')}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              ) : showConfirmDelete === wishlist.id ? (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                    Are you sure you want to delete this wishlist?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowConfirmDelete(null)}
                      className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(wishlist.id)}
                      className="px-2 py-1 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {wishlist.name}
                    </span>
                    <div className="flex items-center space-x-1 ml-2">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => startEdit(wishlist)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setShowConfirmDelete(wishlist.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    href={wishlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center mt-2 text-sm text-blue-500 hover:text-blue-700"
                  >
                    <span className="truncate">{wishlist.url}</span>
                    <ExternalLink size={14} className="ml-1 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {wishlists && wishlists.length > 0 && canEdit && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Pro tip: Manage all your wishes in one place!</p>
              <p className="mb-2">You can add items from these external wishlists directly to your app wishlist for easier tracking.</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-1">
                <li>Copy item URLs from your external wishlists</li>
                <li>Use the + button to add items here</li>
                <li>Paste the URL - we'll fetch the details automatically!</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalWishlistsPanel;
