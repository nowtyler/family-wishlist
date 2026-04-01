import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useTheme } from './ThemeContext';
import { useAppContext } from './AppContext';
import { HelpCircle, X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { completeTutorial as completeTutorialAPI, skipTutorial as skipTutorialAPI, resetTutorial as resetTutorialAPI, createShoppingCartItem, deleteShoppingCartItem, getShoppingCartItems } from '../services/api';
import { log } from '../utils/logger';

export const TUTORIAL_DUMMY_MARKER = '__TUTORIAL_DUMMY__';

const TutorialContext = createContext(null);

export const useTutorial = () => useContext(TutorialContext);

// Targets that require the Browse sheet to be open
const BROWSE_SHEET_TARGETS = new Set([
  '#tutorial-browse-wishlists',
]);

// Targets that require the More sheet to be open
const MORE_SHEET_TARGETS = new Set([
  '#tutorial-external-wishlists',
  '#tutorial-preferences',
]);

// Targets that require the shopping cart to be open
const CART_INTERIOR_TARGETS = new Set([
  '#tutorial-cart-item-row',
  '#tutorial-cart-item-status',
  '#tutorial-cart-item-delete',
  '#tutorial-cart-add-button',
]);

const isBrowseSheetStep = (step) => BROWSE_SHEET_TARGETS.has(step?.target);
const isMoreSheetStep = (step) => MORE_SHEET_TARGETS.has(step?.target);
const isCartInteriorStep = (step) => CART_INTERIOR_TARGETS.has(step?.target);

// Custom tooltip component matching the app's design
const CustomTooltip = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
}) => {
  const { darkMode } = useTheme();
  const { onClick: primaryOnClick, ...primaryButtonProps } = primaryProps || {};

  const handlePrimaryClick = (event) => {
    // BottomTabNav handles opening sheets automatically based on tutorial context
    primaryOnClick?.(event);
  };

  return (
    <div
      {...tooltipProps}
      className={`rounded-xl shadow-2xl max-w-sm ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      }`}
      style={{
        zIndex: 10000,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        darkMode ? 'border-gray-700' : 'border-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 flex items-center justify-center">
            <HelpCircle size={16} className="text-white" />
          </div>
          {step.title && (
            <h3 className="font-semibold text-base">{step.title}</h3>
          )}
        </div>
        <button
          {...closeProps}
          className={`p-1 rounded-full transition-colors ${
            darkMode
              ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          }`}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className={`text-sm leading-relaxed ${
          darkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {step.content}
        </div>
      </div>

      {/* Footer */}
      <div className={`px-4 py-3 border-t ${
        darkMode ? 'border-gray-700' : 'border-gray-100'
      }`}>
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            {Array.from({ length: size }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? 'w-6 bg-gradient-to-r from-sky-500 to-indigo-500'
                    : i < index
                    ? `w-1.5 ${darkMode ? 'bg-indigo-400' : 'bg-indigo-300'}`
                    : `w-1.5 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`
                }`}
              />
            ))}
          </div>
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {index + 1} of {size}
          </span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            {...skipProps}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              darkMode
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1">
              <SkipForward size={14} />
              Skip tour
            </span>
          </button>

          <div className="flex gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            {continuous && (
              <button
                {...primaryButtonProps}
                onClick={handlePrimaryClick}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 transition-all shadow-md hover:shadow-lg"
              >
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** @type {import('react-joyride').Step[]} */
const tutorialSteps = [
  {
    target: '#tutorial-fab-button',
    title: 'Welcome to Family Wishlist!',
    content: 'This is your navigation bar at the bottom with all your main features.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-home-tab',
    title: 'Home',
    content: 'View your personal wishlist here. This is where you add items you\'d like to receive.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-browse-tab',
    title: 'Browse',
    content: 'Browse family members\' wishlists to see what everyone is hoping for. You can mark items as \"thinking about\" or add them straight to your cart.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-add-item',
    title: 'Add Item',
    content: 'Tap the + button to add new items to your wishlist. Paste a product link to auto-fill the title and price, or enter details manually.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-shopping-cart',
    title: 'Shopping Cart',
    content: 'Collect and organize gift ideas while browsing. Track everything you\'re planning to buy in one place.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-cart-item-row',
    title: 'Your Cart Items',
    content: 'Here\'s where your cart items appear, grouped by recipient. Let\'s take a closer look at what you can do with each item.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-cart-item-status',
    title: 'Mark as Purchased',
    content: 'Tap the circle to mark a gift as purchased once you\'ve bought it. This helps you keep track of what\'s done.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#tutorial-cart-item-delete',
    title: 'Remove Items',
    content: 'Remove an item when the recipient has received their gift, or if you want to release it so someone else can buy it instead.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#tutorial-cart-add-button',
    title: 'Track Non-Wishlist Gifts',
    content: 'Add gifts you found on your own that aren\'t on anyone\'s wishlist. Great for keeping all your gift plans in one place.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-more-tab',
    title: 'More',
    content: 'Access external wishlists (Amazon, Etsy links), your size and gift preferences, and quick access to shared wishlists you own.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-settings',
    title: 'Settings',
    content: 'Access your profile to change your password and manage households. The dark mode toggle is right next to this icon. You can also create shared wishlists here — great for kids or joint gifts, with co-owners who can all manage the same list.',
    disableBeacon: true,
    placement: 'bottom',
  },
];

export const TutorialProvider = ({ children }) => {
  const { darkMode } = useTheme();
  const { selectedUser } = useAppContext();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [joyrideKey, setJoyrideKey] = useState(0);
  const menuRetryRef = useRef(null);
  const autoStartAttemptedRef = useRef(false);
  const tutorialCartItemIdRef = useRef(null);
  const cartControlRef = useRef({ open: null, close: null });

  // Lock background scrolling while tutorial is active
  useEffect(() => {
    if (run) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [run]);

  // Check if tutorial should be shown based on tutorial_status from database
  // Show if status is "new" or if it was "completed" and being reset
  const shouldShowTutorial = selectedUser?.tutorial_status === "new";

  // Auto-start tutorial for first-time users
  useEffect(() => {
    // Only attempt auto-start once per session per user
    if (autoStartAttemptedRef.current) {
      return;
    }

    if (!selectedUser?.id || !shouldShowTutorial || run) {
      log('Tutorial auto-start check:', {
        hasUser: !!selectedUser?.id,
        shouldShow: shouldShowTutorial,
        isRunning: run,
        firstLogin: selectedUser?.first_login
      });
      return;
    }

    // Mark that we've attempted auto-start
    autoStartAttemptedRef.current = true;
    log('Tutorial auto-start: Waiting for DOM to be ready...');

    // Wait for DOM elements to be ready before starting
    let retries = 0;
    const maxRetries = 10;

    const checkDOMReady = () => {
      retries++;
      const fabButton = document.querySelector('#tutorial-fab-button');
      log(`Tutorial DOM check (attempt ${retries}/${maxRetries}):`, { found: !!fabButton });

      if (fabButton) {
        log('Tutorial DOM ready! Starting tutorial...');
        setStepIndex(0);
        setRun(true);
      } else if (retries < maxRetries) {
        // Retry after 500ms
        setTimeout(checkDOMReady, 500);
      } else {
        console.warn('Tutorial: DOM not ready after multiple retries');
      }
    };

    // Start checking after initial delay
    const initialTimeoutId = setTimeout(checkDOMReady, 500);

    return () => clearTimeout(initialTimeoutId);
  }, [selectedUser?.id, shouldShowTutorial, run]);

  useLayoutEffect(() => {
    if (!run) {
      return;
    }

    const step = tutorialSteps[stepIndex];
    if (!step) {
      return;
    }

    // Scroll element into view within its sheet if it's a sheet-based step
    const isSheetStep = isBrowseSheetStep(step) || isMoreSheetStep(step);
    if (isSheetStep && step.target !== '#tutorial-browse-tab' && step.target !== '#tutorial-more-tab') {
      // Scroll immediately so element is ready for Joyride
      const element = document.querySelector(step.target);
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }

    menuRetryRef.current = null;
  }, [run, stepIndex]);

  // Manually start the tutorial
  const startTutorial = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  // Stop the tutorial
  const stopTutorial = useCallback(() => {
    setRun(false);
  }, []);

  const registerCartControl = useCallback((controls) => {
    cartControlRef.current = controls;
  }, []);

  const createTutorialCartItem = useCallback(async () => {
    if (!selectedUser?.id || tutorialCartItemIdRef.current) return true;
    try {
      // Check for leftover dummy items from a previous aborted tutorial
      const existing = await getShoppingCartItems(selectedUser.id);
      const items = Array.isArray(existing?.data) ? existing.data : [];
      const leftover = items.find((i) => i.notes === TUTORIAL_DUMMY_MARKER);
      if (leftover) {
        tutorialCartItemIdRef.current = leftover.id;
        return true;
      }
      const response = await createShoppingCartItem({
        buyer_id: selectedUser.id,
        recipient_name: 'Tutorial Example',
        title: 'Example Gift Item',
        notes: TUTORIAL_DUMMY_MARKER,
        price: 2499,
      });
      if (response?.data?.id) {
        tutorialCartItemIdRef.current = response.data.id;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create tutorial cart item:', error);
      return false;
    }
  }, [selectedUser?.id]);

  const deleteTutorialCartItem = useCallback(async () => {
    const itemId = tutorialCartItemIdRef.current;
    if (!itemId) return;
    tutorialCartItemIdRef.current = null;
    try {
      await deleteShoppingCartItem(itemId);
    } catch (error) {
      // Item may already be deleted (user deleted it during tutorial)
      console.warn('Failed to delete tutorial cart item:', error);
    }
  }, []);

  const cleanupCartTutorial = useCallback(() => {
    deleteTutorialCartItem();
    cartControlRef.current.close?.();
  }, [deleteTutorialCartItem]);

  // Mark tutorial as completed
  const completeTutorial = useCallback(async () => {
    if (!selectedUser?.id) return;

    try {
      cleanupCartTutorial();
      await completeTutorialAPI(selectedUser.id);
      setRun(false);
    } catch (error) {
      console.error('Failed to mark tutorial as completed:', error);
    }
  }, [selectedUser?.id, cleanupCartTutorial]);

  // Mark tutorial as skipped
  const skipTutorial = useCallback(async () => {
    if (!selectedUser?.id) return;

    try {
      cleanupCartTutorial();
      await skipTutorialAPI(selectedUser.id);
      setRun(false);
    } catch (error) {
      console.error('Failed to mark tutorial as skipped:', error);
    }
  }, [selectedUser?.id, cleanupCartTutorial]);

  const queueStepChange = useCallback(async (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= tutorialSteps.length) {
      return;
    }

    const currentStep = tutorialSteps[stepIndex];
    const nextStep = tutorialSteps[nextIndex];
    const enteringCart = isCartInteriorStep(nextStep) && !isCartInteriorStep(currentStep);
    const leavingCart = !isCartInteriorStep(nextStep) && isCartInteriorStep(currentStep);
    const needsSheetOpen = isBrowseSheetStep(nextStep) || isMoreSheetStep(nextStep);

    if (enteringCart) {
      // Create dummy item, open cart, wait for render
      const created = await createTutorialCartItem();
      if (!created) {
        // Skip cart steps if we couldn't create the dummy item
        const firstNonCartIndex = tutorialSteps.findIndex(
          (s, i) => i > nextIndex && !isCartInteriorStep(s)
        );
        if (firstNonCartIndex !== -1) {
          setStepIndex(firstNonCartIndex);
        }
        return;
      }
      cartControlRef.current.open?.();
      setTimeout(() => {
        // Scroll the cart's scrollable container to the top so the tutorial item
        // is visible and joyride spotlight aligns correctly
        const cartScroller = document.querySelector('[data-cart-scroll-container]');
        if (cartScroller) cartScroller.scrollTop = 0;
        setStepIndex(nextIndex);
      }, 1000);
      return;
    }

    if (leavingCart) {
      cleanupCartTutorial();
      // Small delay for cart to close before showing next step
      setTimeout(() => {
        setStepIndex(nextIndex);
      }, 400);
      return;
    }

    if (needsSheetOpen) {
      // Give BottomTabNav time to animate the sheet open, scroll content, and Joyride to find the element
      // Sheet animation: ~300ms, scroll into view: ~200ms, buffer: ~100ms
      setTimeout(() => {
        setStepIndex(nextIndex);
      }, 600);
      return;
    }

    setStepIndex(nextIndex);
  }, [stepIndex, createTutorialCartItem, cleanupCartTutorial]);

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback((data) => {
    const { action, index, status, type, step } = data;
    const isLastStep = index === tutorialSteps.length - 1;

    // Handle tour completion or skip first
    if (status === STATUS.FINISHED) {
      setRun(false);
      setStepIndex(0);
      completeTutorial();
      return;
    }

    if (status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);
      skipTutorial();
      return;
    }

    // Handle close action - stop the tour WITHOUT marking complete
    // This allows the tutorial to restart on next login
    if (action === ACTIONS.CLOSE) {
      cleanupCartTutorial();
      setRun(false);
      setStepIndex(0);
      // Don't call completeTutorial() - let it restart on next login
      return;
    }

    // Only advance on STEP_AFTER with explicit NEXT or PREV actions
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        if (isLastStep) {
          setRun(false);
          setStepIndex(0);
          completeTutorial();
          return;
        }
        queueStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        queueStepChange(index - 1);
      }
    }

    // Handle target not found - skip to next step or retry
    if (type === EVENTS.TARGET_NOT_FOUND) {
      const isCartStep = isCartInteriorStep(step);
      const isSheetStep = isBrowseSheetStep(step) || isMoreSheetStep(step);

      if (isCartStep) {
        if (menuRetryRef.current === index) {
          // Already retried, skip remaining cart steps
          const firstNonCartIndex = tutorialSteps.findIndex(
            (s, i) => i > index && !isCartInteriorStep(s)
          );
          cleanupCartTutorial();
          if (firstNonCartIndex !== -1) {
            setStepIndex(firstNonCartIndex);
          } else {
            setStepIndex(index + 1);
          }
          return;
        }
        menuRetryRef.current = index;
        // Re-open cart and retry
        cartControlRef.current.open?.();
        setTimeout(() => {
          const cartScroller = document.querySelector('[data-cart-scroll-container]');
          if (cartScroller) cartScroller.scrollTop = 0;
          setJoyrideKey((current) => current + 1);
        }, 500);
        return;
      }

      if (isSheetStep) {
        // Give the sheet a moment to open (BottomTabNav handles this via context)
        if (menuRetryRef.current === index) {
          // Already retried, skip to next step
          setStepIndex(index + 1);
          return;
        }

        menuRetryRef.current = index;
        // Force Joyride to re-check by incrementing key
        setJoyrideKey((current) => current + 1);
        return;
      }

      // For non-sheet steps, just skip
      setStepIndex(index + 1);
    }
  }, [completeTutorial, skipTutorial, cleanupCartTutorial, queueStepChange]);

  const currentStep = tutorialSteps[stepIndex] || null;

  // Cleanup dummy cart item on unmount if tutorial was interrupted
  useEffect(() => {
    return () => {
      if (tutorialCartItemIdRef.current) {
        deleteTutorialCartItem();
      }
    };
  }, [deleteTutorialCartItem]);

  const isCartDemoActive = run && isCartInteriorStep(currentStep);

  const value = {
    run,
    stepIndex,
    currentStep,
    isCartDemoActive,
    startTutorial,
    stopTutorial,
    completeTutorial,
    skipTutorial,
    registerCartControl,
    resetTutorial: async () => {
      if (!selectedUser?.id) return;
      try {
        await resetTutorialAPI(selectedUser.id);
        // After resetting, start the tutorial automatically
        setStepIndex(0);
        setRun(true);
      } catch (error) {
        console.error('Failed to reset tutorial:', error);
      }
    },
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <Joyride
        key={joyrideKey}
        steps={tutorialSteps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress
        disableScrolling
        disableOverlayClose
        spotlightClicks
        callback={handleJoyrideCallback}
        tooltipComponent={CustomTooltip}
        floaterProps={{
          disableAnimation: false,
          options: {
            preventOverflow: {
              boundariesElement: 'window',
              padding: 12,
            },
            flip: {
              padding: 12,
            },
          },
        }}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: darkMode ? '#1f2937' : '#ffffff',
          },
          spotlight: {
            borderRadius: 12,
          },
          overlay: {
            backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />
    </TutorialContext.Provider>
  );
};

export default TutorialContext;
