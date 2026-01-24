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
import { HelpCircle, X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';

const TutorialContext = createContext(null);

export const useTutorial = () => useContext(TutorialContext);

const TUTORIAL_STORAGE_KEY = 'wishlist_tutorial_completed';
const TUTORIAL_NEVER_SHOW_KEY = 'wishlist_tutorial_never_show';
const MENU_STEP_TARGETS = new Set([
  '#tutorial-add-item',
  '#tutorial-browse-wishlists',
  '#tutorial-external-wishlists',
  '#tutorial-preferences',
]);

const isMenuStep = (step) => MENU_STEP_TARGETS.has(step?.target);

const requestMenuOpenForTutorial = () => {
  ensureMenuOpenForTutorial();
  requestAnimationFrame(() => {
    ensureMenuOpenForTutorial();
  });
};

const ensureMenuOpenForTutorial = () => {
  for (const target of MENU_STEP_TARGETS) {
    if (document.querySelector(target)) {
      return;
    }
  }

  const fabButton = document.querySelector('#tutorial-fab-button');
  if (!fabButton) {
    return;
  }

  const isExpanded = fabButton.getAttribute('aria-expanded') === 'true';
  if (!isExpanded) {
    fabButton.click();
  }
};

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
    if (step?.target === '#tutorial-fab-button') {
      ensureMenuOpenForTutorial();
    }
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
    title: 'Quick Actions Menu',
    content: 'Tap this button to access quick actions like adding items, browsing wishlists, and viewing external links. It\'s your main hub for navigation!',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-add-item',
    title: 'Add Wishlist Items',
    content: 'When viewing your own wishlist, use this button to add new items. You can paste a URL to auto-fill product details, or enter them manually.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-browse-wishlists',
    title: 'Browse Family Wishlists',
    content: 'Switch between family members\' wishlists to see what they\'re hoping for. You can mark items as "thinking about" or "purchased" to coordinate gifts!',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-external-wishlists',
    title: 'External Wishlists',
    content: 'Some family members have wishlists on other sites like Amazon. Find links to those external wishlists here.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-preferences',
    title: 'Sizes & Preferences',
    content: 'View and edit clothing sizes, favorite colors, and other gift preferences. Helpful info for finding the perfect gift!',
    disableBeacon: true,
    placement: 'top',
  },
  {
    target: '#tutorial-settings',
    title: 'Settings & Profile',
    content: 'Access your profile settings, edit your account, manage households, and import/export your wishlist data.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#tutorial-theme-toggle',
    title: 'Dark/Light Mode',
    content: 'Toggle between dark and light themes based on your preference.',
    disableBeacon: true,
    placement: 'bottom',
  },
];

export const TutorialProvider = ({ children }) => {
  const { darkMode } = useTheme();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true); // Default true to prevent flash
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [joyrideKey, setJoyrideKey] = useState(0);
  const menuRetryRef = useRef(null);

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const neverShow = localStorage.getItem(TUTORIAL_NEVER_SHOW_KEY);

    setHasSeenTutorial(completed === 'true');
    setNeverShowAgain(neverShow === 'true');
  }, []);

  useLayoutEffect(() => {
    if (!run) {
      return;
    }

    const step = tutorialSteps[stepIndex];
    if (isMenuStep(step)) {
      requestMenuOpenForTutorial();
    }

    menuRetryRef.current = null;
  }, [run, stepIndex]);

  // Start tutorial for first-time users (after a short delay)
  const startTutorialForNewUser = useCallback(() => {
    // Don't restart if already running
    if (!hasSeenTutorial && !neverShowAgain && !run) {
      // Small delay to ensure DOM elements are rendered
      setTimeout(() => {
        setStepIndex(0);
        setRun(true);
      }, 1500);
    }
  }, [hasSeenTutorial, neverShowAgain, run]);

  // Manually start the tutorial
  const startTutorial = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  // Stop the tutorial
  const stopTutorial = useCallback(() => {
    setRun(false);
  }, []);

  // Reset tutorial (for testing or re-showing)
  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    localStorage.removeItem(TUTORIAL_NEVER_SHOW_KEY);
    setHasSeenTutorial(false);
    setNeverShowAgain(false);
  }, []);

  // Mark tutorial as completed with "never show again" option
  const completeTutorial = useCallback((dontShowAgain = false) => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setHasSeenTutorial(true);

    if (dontShowAgain) {
      localStorage.setItem(TUTORIAL_NEVER_SHOW_KEY, 'true');
      setNeverShowAgain(true);
    }
  }, []);

  const queueStepChange = useCallback((nextIndex) => {
    if (nextIndex < 0 || nextIndex >= tutorialSteps.length) {
      return;
    }

    const nextStep = tutorialSteps[nextIndex];
    if (isMenuStep(nextStep)) {
      requestMenuOpenForTutorial();
      setTimeout(() => {
        setStepIndex(nextIndex);
      }, 0);
      return;
    }

    setStepIndex(nextIndex);
  }, []);

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback((data) => {
    const { action, index, status, type, step } = data;
    const isLastStep = index === tutorialSteps.length - 1;

    // Handle tour completion or skip first
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      setStepIndex(0);
      completeTutorial(status === STATUS.SKIPPED);
      return;
    }

    if (type === EVENTS.STEP_BEFORE && isMenuStep(step)) {
      requestMenuOpenForTutorial();
    }

    // Handle close action - stop the tour and mark complete
    if (action === ACTIONS.CLOSE) {
      setRun(false);
      setStepIndex(0);
      completeTutorial(false);
      return;
    }

    // Only advance on STEP_AFTER with explicit NEXT or PREV actions
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        if (isLastStep) {
          setRun(false);
          setStepIndex(0);
          completeTutorial(false);
          return;
        }
        queueStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        queueStepChange(index - 1);
      }
    }

    // Handle target not found - skip to next step
    if (type === EVENTS.TARGET_NOT_FOUND) {
      if (isMenuStep(step)) {
        if (menuRetryRef.current === index) {
          setStepIndex(index + 1);
          return;
        }

        menuRetryRef.current = index;
        requestMenuOpenForTutorial();
        setJoyrideKey((current) => current + 1);
        return;
      }

      setStepIndex(index + 1);
    }
  }, [completeTutorial, queueStepChange]);

  const currentStep = tutorialSteps[stepIndex] || null;

  const value = {
    run,
    stepIndex,
    currentStep,
    hasSeenTutorial,
    neverShowAgain,
    startTutorial,
    stopTutorial,
    resetTutorial,
    completeTutorial,
    startTutorialForNewUser,
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
        scrollToFirstStep
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
