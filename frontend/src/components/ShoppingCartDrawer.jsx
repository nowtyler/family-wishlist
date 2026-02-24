import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronsDown, ChevronsUp, Circle, Link, Loader, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppContext } from '../contexts/AppContext';
import { createShoppingCartItem, deleteShoppingCartItem, fetchProductDetailsFromUrl, getShoppingCartItems, getNotifications, markNotificationRead, updateShoppingCartItem } from '../services/api';

const emptyFormState = {
  title: '',
  recipientId: '',
  recipientName: '',
  notes: '',
  link: '',
  price: '',
};

const formatPriceToCents = (price) => {
  if (price === '' || price === null || price === undefined) {
    return null;
  }
  const floatValue = Number.parseFloat(String(price));
  if (Number.isNaN(floatValue) || floatValue < 0) {
    return null;
  }
  return Math.round(floatValue * 100);
};

const truncateText = (value, maxLength = 60) => {
  if (!value) return '';
  const nextValue = String(value);
  if (nextValue.length <= maxLength) return nextValue;
  return `${nextValue.slice(0, Math.max(0, maxLength - 1))}…`;
};

const formatPrice = (price) => {
  if (price === null || price === undefined || Number.isNaN(Number(price))) {
    return null;
  }
  return `$${(Number(price) / 100).toFixed(2)}`;
};

const ShoppingCartDrawer = ({
  isOpen,
  onClose,
  defaultRecipientId,
  onCartUpdated = null,
  onCartChanged = null,
  onOpenWishlistItem = null,
  onNotificationCountUpdate = null,
}) => {
  const { familyMembers, selectedUser } = useAppContext();
  const [formState, setFormState] = useState(emptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [lastAddedSummary, setLastAddedSummary] = useState('');
  const [collapsedRecipients, setCollapsedRecipients] = useState({});
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toggleButtonRef = React.useRef(null);
  const titleInputRef = React.useRef(null);
  const pullStartYRef = React.useRef(null);
  const [cartItems, setCartItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [urlToImport, setUrlToImport] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [urlImportDismissed, setUrlImportDismissed] = useState(false);

  const recipientOptions = useMemo(
    () => (Array.isArray(familyMembers) ? familyMembers : []),
    [familyMembers]
  );

  const recipientLookup = useMemo(() => {
    const lookup = new Map();
    recipientOptions.forEach((member) => {
      lookup.set(String(member.id), member);
    });
    return lookup;
  }, [recipientOptions]);

  const notifiedItemIds = useMemo(() => {
    return new Set(notifications.map((n) => n.cart_item_id).filter(Boolean));
  }, [notifications]);

  const cartTotalCents = useMemo(() => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;
    return cartItems.reduce((sum, item) => {
      const price = Number(item?.price);
      if (!Number.isFinite(price) || price < 0) return sum;
      return sum + price;
    }, 0);
  }, [cartItems]);

  const cartTotalLabel = useMemo(() => formatPrice(cartTotalCents) || '$0.00', [cartTotalCents]);

  const isAdminCartNotice = (message = '') => {
    return message.toLowerCase().startsWith('an admin ');
  };

  const previousCustomRecipientNames = useMemo(() => {
    if (!Array.isArray(cartItems)) return [];
    const seen = new Map();
    cartItems.forEach((item) => {
      if (item?.recipient_id == null && item?.recipient_name) {
        const trimmed = String(item.recipient_name).trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, trimmed);
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [cartItems]);

  const getDaysUntilBirthday = (birthday) => {
    if (!birthday) return null;
    try {
      const [year, month, day] = birthday.split('-').map((num) => Number.parseInt(num, 10));
      if (!month || !day) return null;
      const today = new Date();
      const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
      if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(today.getFullYear() + 1);
      }
      const diffTime = birthdayThisYear.getTime() - today.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      return null;
    }
  };

  const groupedCartItems = useMemo(() => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return [];
    const groups = cartItems.reduce((acc, item) => {
      const key = item.recipient_id != null
        ? String(item.recipient_id)
        : `custom:${item.recipient_name || 'unknown'}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([key, items]) => {
        const firstItem = items[0];
        const recipient = firstItem.recipient_id != null
          ? recipientLookup.get(String(firstItem.recipient_id))
          : null;
        return {
          recipientId: key,
          recipient,
          recipientName: recipient?.name || firstItem.recipient_name || 'Unknown',
          items,
          daysUntil: recipient?.birthday ? getDaysUntilBirthday(recipient.birthday) : null,
        };
      })
      .sort((a, b) => {
        if (a.daysUntil === null && b.daysUntil === null) return 0;
        if (a.daysUntil === null) return 1;
        if (b.daysUntil === null) return -1;
        return a.daysUntil - b.daysUntil;
      });
  }, [cartItems, recipientLookup]);

  const toggleRecipientCollapse = (recipientId) => {
    setCollapsedRecipients((prev) => ({
      ...prev,
      [recipientId]: !prev[recipientId],
    }));
  };

  const allCollapsed = useMemo(() => {
    if (groupedCartItems.length === 0) return false;
    return groupedCartItems.every((group) => Boolean(collapsedRecipients[group.recipientId]));
  }, [groupedCartItems, collapsedRecipients]);

  const handleToggleAllCollapsed = () => {
    const nextState = {};
    groupedCartItems.forEach((group) => {
      nextState[group.recipientId] = !allCollapsed;
    });
    setCollapsedRecipients(nextState);
  };

  const handlePullToRefresh = async () => {
    if (isLoadingItems || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchCartItems();
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchCartItems = async () => {
    if (!selectedUser?.id) return;
    setIsLoadingItems(true);
    setItemsError('');
    try {
      const response = await getShoppingCartItems(selectedUser.id);
      const nextItems = Array.isArray(response?.data) ? response.data : [];
      setCartItems(nextItems);
      onCartUpdated?.(nextItems.length);
    } catch (error) {
      console.error('Failed to load shopping cart items:', error);
      setItemsError('Could not load cart items.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchNotifications = async () => {
    if (!selectedUser?.id) return;
    try {
      const response = await getNotifications(selectedUser.id);
      const nextNotifications = Array.isArray(response?.data) ? response.data : [];
      setNotifications(nextNotifications);
      onNotificationCountUpdate?.(nextNotifications.length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleDismissNotification = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== notificationId);
        onNotificationCountUpdate?.(next.length);
        return next;
      });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleRemoveNotifiedItem = async (notification) => {
    try {
      if (notification.cart_item_id) {
        await deleteShoppingCartItem(notification.cart_item_id);
      }
      await markNotificationRead(notification.id);
      setCartItems((prev) => {
        const next = notification.cart_item_id
          ? prev.filter((item) => item.id !== notification.cart_item_id)
          : prev;
        onCartUpdated?.(next.length);
        return next;
      });
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== notification.id);
        onNotificationCountUpdate?.(next.length);
        return next;
      });
      onCartChanged?.();
    } catch (error) {
      console.error('Failed to remove notified item:', error);
      toast.error('Failed to remove item.');
    }
  };

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'purchased' ? 'pending' : 'purchased';
    try {
      await updateShoppingCartItem(item.id, { status: newStatus });
      setCartItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: newStatus } : i
        )
      );
    } catch (error) {
      console.error('Failed to update cart item status:', error);
      toast.error('Failed to update status.');
    }
  };

  const handleRemoveItem = async (item) => {
    const cartItemId = item?.id;
    const changePayload = {
      wishlistItemId: item?.wishlist_item_id ?? null,
      sharedWishlistItemId: item?.shared_wishlist_item_id ?? null
    };
    onCartChanged?.({ ...changePayload, optimistic: true });
    try {
      await deleteShoppingCartItem(cartItemId);
      setCartItems((prev) => {
        const nextItems = Array.isArray(prev) ? prev.filter((cartItem) => cartItem.id !== cartItemId) : [];
        onCartUpdated?.(nextItems.length);
        return nextItems;
      });
      onCartChanged?.({ ...changePayload, optimistic: false });
      toast.success('Removed from cart.');
    } catch (error) {
      console.error('Failed to remove cart item:', error);
      onCartChanged?.({ ...changePayload, revert: true });
      toast.error('Failed to remove item from cart.');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setFormState((prev) => ({
        ...prev,
        recipientId: defaultRecipientId ? String(defaultRecipientId) : prev.recipientId,
      }));
      setIsManualEntryOpen(false);
    }
  }, [defaultRecipientId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setFormState((prev) => ({
        ...prev,
        recipientId: prev.recipientId || (defaultRecipientId ? String(defaultRecipientId) : ''),
      }));
    }
  }, [defaultRecipientId, isOpen]);

  useEffect(() => {
    if (isManualEntryOpen) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    } else {
      setUrlToImport('');
      setImportSuccess(false);
      setUrlError('');
      setUrlImportDismissed(false);
    }
  }, [isManualEntryOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchCartItems();
      fetchNotifications();
    }
  }, [isOpen, selectedUser?.id]);

  const handleChange = (field) => (event) => {
    setFormState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleImportUrl = async () => {
    if (!urlToImport.trim()) {
      setUrlError('Please enter a URL.');
      return;
    }
    if (urlToImport.toLowerCase().includes('etsy.com')) {
      setUrlError('Etsy URLs cannot be imported automatically. The link has been saved below.');
      setFormState((prev) => ({ ...prev, link: urlToImport }));
      return;
    }
    setUrlError('');
    setIsImporting(true);
    try {
      const details = await fetchProductDetailsFromUrl(urlToImport);
      if (details.error) {
        setUrlError(details.message || 'Could not import details. The link has been saved below.');
        setFormState((prev) => ({ ...prev, link: details.url || urlToImport }));
      } else {
        setFormState((prev) => ({
          ...prev,
          title: details.title || prev.title,
          price: details.price != null ? details.price.toString() : prev.price,
          link: details.url || urlToImport,
        }));
        setImportSuccess(true);
      }
    } catch (err) {
      setUrlError('Import failed. The link has been saved below.');
      setFormState((prev) => ({ ...prev, link: urlToImport }));
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const isCustomRecipientSelection = formState.recipientId.startsWith('custom:');
    const selectedCustomRecipientName = isCustomRecipientSelection
      ? formState.recipientId.slice('custom:'.length)
      : '';

    if (!formState.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!formState.recipientId || (formState.recipientId === 'other' && !formState.recipientName.trim())) {
      toast.error(formState.recipientId === 'other' ? 'Please enter a recipient name.' : 'Please select a recipient.');
      return;
    }

    const priceInCents = formatPriceToCents(formState.price);
    if (formState.price && priceInCents === null) {
      toast.error('Price must be a valid number.');
      return;
    }

    const payload = {
      buyer_id: selectedUser?.id,
      title: formState.title.trim(),
      notes: formState.notes.trim() || null,
      link: formState.link.trim() || null,
      price: priceInCents,
    };
    if (formState.recipientId && formState.recipientId !== 'other' && !isCustomRecipientSelection) {
      payload.recipient_id = Number(formState.recipientId);
    } else if (isCustomRecipientSelection) {
      payload.recipient_name = selectedCustomRecipientName.trim();
    } else {
      payload.recipient_name = formState.recipientName.trim();
    }

    try {
      setIsSubmitting(true);
      const response = await createShoppingCartItem(payload);
      toast.success('Added to cart.');
      setFormState({
        ...emptyFormState,
        recipientId: defaultRecipientId ? String(defaultRecipientId) : '',
      });
      const displayName = payload.recipient_id
        ? (recipientLookup.get(String(payload.recipient_id))?.name || `Member #${payload.recipient_id}`)
        : payload.recipient_name;
      setLastAddedSummary(`${payload.title} for ${displayName}`);
      setIsManualEntryOpen(false);
      requestAnimationFrame(() => {
        toggleButtonRef.current?.focus();
      });
      if (response?.data?.id) {
        setCartItems((prev) => {
          const nextItems = Array.isArray(prev) ? prev.filter((item) => item.id !== response.data.id) : [];
          const updated = [response.data, ...nextItems];
          onCartUpdated?.(updated.length);
          return updated;
        });
      } else {
        fetchCartItems();
      }
    } catch (error) {
      toast.error('Failed to add item to cart.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed left-0 right-0 top-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-label="Shopping cart panel"
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cart</h2>
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {cartItems.length === 0 ? 'Empty' : `${cartItems.length} item${cartItems.length === 1 ? '' : 's'}`}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    Total {cartTotalLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review items or add a quick entry</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close cart panel"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <form
              id="shopping-cart-entry-form"
              onSubmit={handleSubmit}
              className="relative flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 pb-24"
              onTouchStart={(event) => {
                if (event.currentTarget.scrollTop > 0) return;
                pullStartYRef.current = event.touches[0]?.clientY ?? null;
              }}
              onTouchMove={(event) => {
                if (pullStartYRef.current === null) return;
                const currentY = event.touches[0]?.clientY ?? 0;
                const distance = currentY - pullStartYRef.current;
                if (distance <= 0) return;
                setIsPulling(true);
                setPullDistance(Math.min(distance, 80));
                event.preventDefault();
              }}
              onTouchEnd={() => {
                if (!isPulling) {
                  pullStartYRef.current = null;
                  return;
                }
                if (pullDistance > 50) {
                  handlePullToRefresh();
                }
                setIsPulling(false);
                setPullDistance(0);
                pullStartYRef.current = null;
              }}
            >
              {notifications.length > 0 && (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-3"
                    >
                      <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          {notification.message}
                        </p>
                        {notification.cart_item_id && !isAdminCartNotice(notification.message) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveNotifiedItem(notification)}
                            className="mt-1 text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline"
                          >
                            Remove from cart
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismissNotification(notification.id)}
                        className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 shrink-0"
                        aria-label="Dismiss notification"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">In your cart</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Grouped by recipient</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {groupedCartItems.length > 1 && (
                      <button
                        type="button"
                        onClick={handleToggleAllCollapsed}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                        title={allCollapsed ? 'Expand all' : 'Collapse all'}
                      >
                        {allCollapsed ? <ChevronsDown size={16} /> : <ChevronsUp size={16} />}
                      </button>
                    )}
                  </div>
                </div>
                {(isPulling || isRefreshing) && (
                  <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {isRefreshing
                      ? 'Refreshing...'
                      : pullDistance > 50
                        ? 'Release to refresh'
                        : 'Pull to refresh'}
                  </div>
                )}
                {itemsError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{itemsError}</p>
                )}
                {!itemsError && !isLoadingItems && cartItems.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your cart is empty for now.</p>
                )}
                {!itemsError && cartItems.length > 0 && (
                  <div className="space-y-3">
                    {groupedCartItems.map((group) => {
                      const isCollapsed = Boolean(collapsedRecipients[group.recipientId]);
                      const daysLabel = group.daysUntil === null
                        ? null
                        : group.daysUntil === 0
                          ? 'today'
                          : group.daysUntil === 1
                            ? 'in 1 day'
                            : `in ${group.daysUntil} days`;
                      return (
                        <div key={group.recipientId} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => toggleRecipientCollapse(group.recipientId)}
                            className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 sticky top-0 z-10 -mx-2 px-2 py-1 rounded-md bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur"
                            aria-expanded={!isCollapsed}
                          >
                            <span>
                              {group.recipientName}
                              {daysLabel && (
                                <span className="ml-2 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                  {daysLabel}
                                </span>
                              )}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <span>{group.items.length}</span>
                              <ChevronDown
                                size={14}
                                className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                              />
                            </span>
                          </button>
                          {!isCollapsed && group.items.map((item, index) => {
                            const priceLabel = formatPrice(item.price);
                            return (
                              <React.Fragment key={item.id}>
                        <div
                                  className={`rounded-md border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-2.5 leading-snug ${
                                  (item.wishlist_item_id || item.shared_wishlist_item_id) ? 'cursor-pointer hover:shadow-md' : ''
                                } ${notifiedItemIds.has(item.id) ? 'border-l-[3px] border-l-amber-400 dark:border-l-amber-500' : ''}`}
                                role={(item.wishlist_item_id || item.shared_wishlist_item_id) ? 'button' : undefined}
                                tabIndex={(item.wishlist_item_id || item.shared_wishlist_item_id) ? 0 : undefined}
                                onClick={() => {
                                  if (item.wishlist_item_id) {
                                    onOpenWishlistItem?.({
                                      memberId: item.recipient_id,
                                      itemId: item.wishlist_item_id,
                                    });
                                  } else if (item.shared_wishlist_item_id && item.shared_wishlist_id) {
                                    onOpenWishlistItem?.({
                                      sharedWishlistId: item.shared_wishlist_id,
                                      sharedWishlistItemId: item.shared_wishlist_item_id,
                                    });
                                  } else {
                                    return;
                                  }
                                  onClose?.();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (item.wishlist_item_id) {
                                      onOpenWishlistItem?.({
                                        memberId: item.recipient_id,
                                        itemId: item.wishlist_item_id,
                                      });
                                    } else if (item.shared_wishlist_item_id && item.shared_wishlist_id) {
                                      onOpenWishlistItem?.({
                                        sharedWishlistId: item.shared_wishlist_id,
                                        sharedWishlistItemId: item.shared_wishlist_item_id,
                                      });
                                    }
                                    onClose?.();
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {truncateText(item.title, 60)}
                                    </p>
                                    {item.status && (
                                      <p className={`text-xs capitalize ${
                                        item.status === 'purchased'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-gray-400 dark:text-gray-500'
                                      }`}>
                                        {item.status}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleStatus(item);
                                      }}
                                      className={`p-0.5 rounded transition-colors ${
                                        item.status === 'purchased'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-gray-300 hover:text-emerald-500 dark:text-gray-600 dark:hover:text-emerald-400'
                                      }`}
                                      aria-label={item.status === 'purchased' ? 'Mark as pending' : 'Mark as purchased'}
                                    >
                                      {item.status === 'purchased' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                    </button>
                                    {priceLabel && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                        {priceLabel}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleRemoveItem(item);
                                      }}
                                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      aria-label="Remove from cart"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                {item.notes && (
                                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                    {item.notes}
                                  </p>
                                )}
                                {item.link && (
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
                                  >
                                    View link
                                  </a>
                                )}
                              </div>
                            </React.Fragment>
                          );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <AnimatePresence initial={false}>
                {isManualEntryOpen && (
                  <motion.div
                    key="manual-entry-overlay"
                    className="absolute inset-0 z-10"
                  >
                    <motion.div
                      key="manual-entry-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm"
                      onClick={() => setIsManualEntryOpen(false)}
                    />
                    <motion.div
                      key="manual-entry"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.25 }}
                      className="absolute left-4 right-4 bottom-4 sm:bottom-5 z-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-4 space-y-4 max-h-[calc(100%-2rem)] overflow-y-auto"
                      id="shopping-cart-manual-entry"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick entry</h3>
                          {lastAddedSummary && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Last added: {lastAddedSummary}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsManualEntryOpen(false)}
                          ref={toggleButtonRef}
                          aria-expanded={isManualEntryOpen}
                          aria-controls="shopping-cart-manual-entry"
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          <span className="inline-flex items-center gap-1">
                            Close
                            <X
                              size={14}
                              className="transition-transform rotate-180"
                            />
                          </span>
                        </button>
                      </div>
                    {!importSuccess && !urlImportDismissed && (
                      <div className="rounded-md border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Link size={14} className="text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Import from URL</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={urlToImport}
                            onChange={(e) => setUrlToImport(e.target.value)}
                            placeholder="https://example.com/product"
                            className="flex-1 min-w-0 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isImporting}
                          />
                          <button
                            type="button"
                            onClick={handleImportUrl}
                            disabled={isImporting}
                            className="shrink-0 rounded-md bg-indigo-600 text-white px-2.5 py-1.5 disabled:opacity-50 hover:bg-indigo-700"
                            aria-label="Import"
                          >
                            {isImporting ? <Loader size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                          </button>
                        </div>
                        {urlError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{urlError}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setUrlImportDismissed(true)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Skip import
                        </button>
                      </div>
                    )}
                    {importSuccess && (
                      <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 px-3 py-2">
                        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                        <p className="text-xs text-green-700 dark:text-green-300">Details imported — review below.</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                      <input
                        type="text"
                        value={formState.title}
                        onChange={handleChange('title')}
                        ref={titleInputRef}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="New item"
                        maxLength={200}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipient</label>
                      <select
                        value={formState.recipientId}
                        onChange={handleChange('recipientId')}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select recipient</option>
                        {recipientOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                        {previousCustomRecipientNames.length > 0 && (
                          <optgroup label="Previously used">
                            {previousCustomRecipientNames.map((name) => (
                              <option key={`custom:${name}`} value={`custom:${name}`}>
                                {name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value="other">Other...</option>
                      </select>
                      {formState.recipientId === 'other' && (
                        <input
                          type="text"
                          value={formState.recipientName}
                          onChange={handleChange('recipientName')}
                          className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter name"
                          maxLength={100}
                          required
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                      <textarea
                        value={formState.notes}
                        onChange={handleChange('notes')}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        rows={3}
                        maxLength={2000}
                        placeholder="Sizing, store, or helpful details"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link</label>
                      <input
                        type="url"
                        value={formState.link}
                        onChange={handleChange('link')}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                      <input
                        type="number"
                        value={formState.price}
                        onChange={handleChange('price')}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
            <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3">
              <button
                type={isManualEntryOpen ? 'submit' : 'button'}
                form={isManualEntryOpen ? 'shopping-cart-entry-form' : undefined}
                disabled={isSubmitting}
                className={`w-full rounded-md py-2.5 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${
                  isManualEntryOpen
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200'
                }`}
                onClick={!isManualEntryOpen ? () => setIsManualEntryOpen(true) : undefined}
              >
                {isManualEntryOpen ? (isSubmitting ? 'Adding...' : 'Add to cart') : 'Add item'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCartDrawer;
