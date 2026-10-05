import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Upload,
  Database,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  exportWishlist,
  importWishlist,
  exportSharedWishlist,
  importSharedWishlist,
  getWishlistItems,
  getSharedWishlistItems
} from '../services/api';
import {
  copyTextToClipboard,
  shareWishlistText,
  canShare,
  formatWishlistAsText
} from '../utils/clipboard';

const ExportShareModal = ({
  isOpen,
  onClose,
  viewingMember = null,
  selectedSharedWishlist = null,
  currentUser = null,
  isAdmin = false,
  items: preloadedItems = null,
  onRefreshWishlist = () => {},
  initialTab = 'text'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'text' | 'backup'
  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef(null);
  const previewTextareaRef = useRef(null);

  const isShared = Boolean(selectedSharedWishlist?.id);

  // Check if current user has permission to backup/restore (must be owner or admin)
  const isOwner = useMemo(() => {
    if (isAdmin) return true;
    if (isShared) {
      return Boolean(selectedSharedWishlist?.owners?.some((o) => o.id === currentUser?.id));
    }
    return Boolean(viewingMember && currentUser && viewingMember.id === currentUser.id);
  }, [isAdmin, isShared, selectedSharedWishlist, viewingMember, currentUser]);

  const listTitle = useMemo(() => {
    if (isShared) {
      return selectedSharedWishlist.name || 'Shared Wishlist';
    }
    if (viewingMember) {
      return viewingMember.id === currentUser?.id
        ? 'Your Wishlist'
        : `${viewingMember.name || 'User'}'s Wishlist`;
    }
    return 'Wishlist';
  }, [isShared, selectedSharedWishlist, viewingMember, currentUser]);

  // Load items when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setActiveTab(initialTab);
    setIsCopied(false);

    // If preloaded items exist and we are viewing personal wishlist, use them
    if (!isShared && Array.isArray(preloadedItems)) {
      setItems(preloadedItems);
      setIsLoadingItems(false);
      return;
    }

    const fetchItems = async () => {
      setIsLoadingItems(true);
      try {
        if (isShared && selectedSharedWishlist?.id) {
          const res = await getSharedWishlistItems(selectedSharedWishlist.id);
          setItems(res.data || []);
        } else if (viewingMember?.id) {
          const res = await getWishlistItems(viewingMember.id);
          setItems(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load wishlist items for export:', err);
        toast.error('Failed to load wishlist items.');
      } finally {
        setIsLoadingItems(false);
      }
    };

    fetchItems();
  }, [isOpen, isShared, selectedSharedWishlist?.id, viewingMember?.id, preloadedItems, initialTab]);

  const formattedText = useMemo(() => {
    return formatWishlistAsText(listTitle, items);
  }, [listTitle, items]);

  const handleCopyText = async () => {
    if (!formattedText) {
      toast.info('There are no items in this wishlist to copy.');
      return;
    }

    const success = await copyTextToClipboard(formattedText);
    if (success) {
      setIsCopied(true);
      toast.success('Wishlist copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      toast.error('Could not copy automatically. Please select all text below to copy manually.');
      if (previewTextareaRef.current) {
        previewTextareaRef.current.focus();
        previewTextareaRef.current.select();
      }
    }
  };

  const handleNativeShare = async () => {
    if (!formattedText) return;
    await shareWishlistText({
      title: listTitle,
      text: formattedText
    });
  };

  const handleSelectAllText = () => {
    if (previewTextareaRef.current) {
      previewTextareaRef.current.focus();
      previewTextareaRef.current.select();
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      let response;
      let filename = 'wishlist';

      if (isShared && selectedSharedWishlist?.id) {
        response = await exportSharedWishlist(selectedSharedWishlist.id);
        const safeName = (selectedSharedWishlist.name || 'shared').toLowerCase().replace(/[^a-z0-9]/g, '-');
        filename = `wishlist-${new Date().toISOString().split('T')[0]}-${safeName}.json`;
      } else if (viewingMember?.id) {
        response = await exportWishlist(viewingMember.id);
        const safeName = (viewingMember.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '-');
        filename = `wishlist-${new Date().toISOString().split('T')[0]}-${safeName}.json`;
      } else {
        return;
      }

      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        if (a.parentNode) {
          document.body.removeChild(a);
        }
      }, 1000);

      toast.success('Backup file exported and downloaded successfully!');
    } catch (err) {
      console.error('Failed to export wishlist JSON:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to export backup file. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleImportFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isOwner) {
      toast.error('You are not authorized to import into this wishlist.');
      return;
    }

    setIsImportingJson(true);
    try {
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result;
            if (typeof content !== 'string') {
              throw new Error('Invalid file format');
            }
            resolve(content);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      const wishlistData = JSON.parse(fileContent);
      let response;

      if (isShared && selectedSharedWishlist?.id) {
        response = await importSharedWishlist(selectedSharedWishlist.id, wishlistData);
      } else if (viewingMember?.id) {
        response = await importWishlist(viewingMember.id, wishlistData);
      } else {
        return;
      }

      const responseData = response.data || response;
      let importedItems = [];
      let skippedItems = [];

      if (Array.isArray(responseData)) {
        importedItems = responseData;
      } else if (responseData && typeof responseData === 'object') {
        importedItems = responseData.imported_items || [];
        skippedItems = responseData.skipped_items || [];
      }

      if (importedItems.length === 0 && skippedItems.length > 0) {
        toast.info('All items were already in your wishlist. No new items were imported.');
      } else if (skippedItems.length > 0) {
        toast.success(`Successfully imported ${importedItems.length} items (${skippedItems.length} duplicates skipped).`);
      } else if (importedItems.length > 0) {
        toast.success(`Successfully imported ${importedItems.length} items!`);
      } else {
        toast.info('Import completed.');
      }

      await onRefreshWishlist(isShared ? selectedSharedWishlist?.id : null);
      onClose();
    } catch (err) {
      console.error('Failed to import wishlist:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to import wishlist. Please check the JSON file format and try again.';
      toast.error(errMsg);
    } finally {
      setIsImportingJson(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isImportingJson && !isExportingJson) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImportingJson, isExportingJson, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isImportingJson && !isExportingJson) {
              onClose();
            }
          }}
        >
          <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-share-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 id="export-share-title" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-500" />
                Share & Export Wishlist
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {listTitle} {items.length > 0 && `(${items.length} item${items.length === 1 ? '' : 's'})`}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isImportingJson || isExportingJson}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Share as Text</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'backup'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Backup & Restore (JSON)</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoadingItems ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-sm">Loading wishlist items...</p>
              </div>
            ) : activeTab === 'text' ? (
              /* TAB 1: Share as Text */
              <div className="space-y-4">
                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl p-3.5 border border-indigo-100 dark:border-indigo-900/40 text-sm text-indigo-900 dark:text-indigo-200">
                  <p className="font-medium">Copy or share your wishlist as plain text</p>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                    Perfect for pasting into text messages, email, group chats, or notes.
                  </p>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="font-medium">This wishlist is currently empty.</p>
                    <p className="text-xs mt-1">Add items to this wishlist first to share them as text.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="wishlist-text-preview" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Text Preview
                      </label>
                      <button
                        type="button"
                        onClick={handleSelectAllText}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Select All
                      </button>
                    </div>

                    <textarea
                      id="wishlist-text-preview"
                      ref={previewTextareaRef}
                      readOnly
                      value={formattedText}
                      rows={8}
                      className="w-full text-xs font-mono p-3 bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 select-all"
                    />

                    {/* Quick action buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-medium text-sm transition-all shadow-sm"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4 text-white" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy to Clipboard</span>
                          </>
                        )}
                      </button>

                      {canShare() && (
                        <button
                          type="button"
                          onClick={handleNativeShare}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-xl font-medium text-sm transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Share App...</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: Backup & Restore (JSON) */
              <div className="space-y-5">
                <div className="bg-sky-50/70 dark:bg-sky-950/30 rounded-xl p-3.5 border border-sky-100 dark:border-sky-900/40 text-sm text-sky-900 dark:text-sky-200">
                  <p className="font-medium">Export or Restore Portable Wishlist Data</p>
                  <p className="text-xs text-sky-700/80 dark:text-sky-300/80 mt-0.5">
                    Save a full backup of all item details as a JSON file, or restore items from a previous backup.
                  </p>
                </div>

                {!isOwner ? (
                  <div className="p-6 text-center bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="font-semibold text-sm">Owner Authorization Required</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Backup and restore files can only be accessed by the owner of this wishlist or family administrators.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Option A: Export Backup */}
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                          <Download className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                          Download Backup
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          Export all items, links, descriptions, and priorities to a JSON file.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportJson}
                        disabled={isExportingJson}
                        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-colors"
                      >
                        {isExportingJson ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Export Backup (.json)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Option B: Restore Backup */}
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                          <Upload className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                          Restore from Backup
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          Import items from a previously saved JSON backup file. Existing items will be preserved.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImportingJson}
                        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-colors"
                      >
                        {isImportingJson ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Select Backup File (.json)</span>
                          </>
                        )}
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImportFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};

export default ExportShareModal;
