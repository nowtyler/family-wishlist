import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronsDown, ChevronsUp, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppContext } from '../contexts/AppContext';
import { createShoppingCartItem, deleteShoppingCartItem, getShoppingCartItems } from '../services/api';

const emptyFormState = {
  title: '',
  recipientId: '',
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

const ShoppingCartDrawer = ({
  isOpen,
  onClose,
  defaultRecipientId,
  onCartUpdated = null,
  onCartChanged = null,
  onOpenWishlistItem = null,
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
      const key = String(item.recipient_id ?? 'unknown');
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([recipientId, items]) => {
        const recipient = recipientLookup.get(String(recipientId));
        return {
          recipientId,
          recipient,
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

  const formatPrice = (price) => {
    if (price === null || price === undefined || Number.isNaN(Number(price))) {
      return null;
    }
    return `$${(Number(price) / 100).toFixed(2)}`;
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

  const handleRemoveItem = async (itemId) => {
    try {
      await deleteShoppingCartItem(itemId);
      setCartItems((prev) => {
        const nextItems = Array.isArray(prev) ? prev.filter((item) => item.id !== itemId) : [];
        onCartUpdated?.(nextItems.length);
        return nextItems;
      });
      onCartChanged?.();
      toast.success('Removed from cart.');
    } catch (error) {
      console.error('Failed to remove cart item:', error);
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
    }
  }, [isManualEntryOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchCartItems();
    }
  }, [isOpen, selectedUser?.id]);

  const handleChange = (field) => (event) => {
    setFormState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!formState.recipientId) {
      toast.error('Please select a recipient.');
      return;
    }

    const priceInCents = formatPriceToCents(formState.price);
    if (formState.price && priceInCents === null) {
      toast.error('Price must be a valid number.');
      return;
    }

    const payload = {
      buyer_id: selectedUser?.id,
      recipient_id: Number(formState.recipientId),
      title: formState.title.trim(),
      notes: formState.notes.trim() || null,
      link: formState.link.trim() || null,
      price: priceInCents,
    };

    try {
      setIsSubmitting(true);
      const response = await createShoppingCartItem(payload);
      toast.success('Added to cart.');
      setFormState({
        ...emptyFormState,
        recipientId: defaultRecipientId ? String(defaultRecipientId) : '',
      });
      setLastAddedSummary(
        `${payload.title}${recipientOptions.length ? ` for ${recipientLookup.get(String(payload.recipient_id))?.name || `Member #${payload.recipient_id}`}` : ''}`
      );
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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            aria-label="Shopping cart drawer"
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cart</h2>
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {cartItems.length === 0 ? 'Empty' : `${cartItems.length} item${cartItems.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review items or add a quick entry</p>
              </div>
              <button
                onClick={onClose}
                className="hidden sm:inline-flex p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 self-start sm:self-center"
                aria-label="Close cart drawer"
              >
                <X size={18} />
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
                              {group.recipient?.name || `Member #${group.recipientId}`}
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
                                  item.wishlist_item_id ? 'cursor-pointer hover:shadow-md' : ''
                                }`}
                                role={item.wishlist_item_id ? 'button' : undefined}
                                tabIndex={item.wishlist_item_id ? 0 : undefined}
                                onClick={() => {
                                  if (!item.wishlist_item_id) return;
                                  onOpenWishlistItem?.({
                                    memberId: item.recipient_id,
                                    itemId: item.wishlist_item_id,
                                  });
                                  onClose?.();
                                }}
                                onKeyDown={(event) => {
                                  if (!item.wishlist_item_id) return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onOpenWishlistItem?.({
                                      memberId: item.recipient_id,
                                      itemId: item.wishlist_item_id,
                                    });
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
                                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                                        {item.status}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {priceLabel && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                        {priceLabel}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleRemoveItem(item.id);
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
                      className="absolute left-4 right-4 bottom-20 sm:bottom-24 z-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-4 space-y-4"
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
                            Hide
                            <ChevronDown
                              size={14}
                              className="transition-transform rotate-180"
                            />
                          </span>
                        </button>
                      </div>
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
                      </select>
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
              <div className="flex items-center gap-3">
                <button
                  type={isManualEntryOpen ? 'submit' : 'button'}
                  form={isManualEntryOpen ? 'shopping-cart-entry-form' : undefined}
                  disabled={isSubmitting}
                  className={`flex-1 rounded-md py-2.5 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    isManualEntryOpen
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200'
                  }`}
                  onClick={!isManualEntryOpen ? () => setIsManualEntryOpen(true) : undefined}
                >
                  {isManualEntryOpen ? (isSubmitting ? 'Adding...' : 'Add to cart') : 'Add item'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  aria-label="Close cart drawer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCartDrawer;
