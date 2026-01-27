import React, { useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const loadTurnstileScript = () => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)) {
    resolve();
    return;
  }
  const script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.onload = () => resolve();
  script.onerror = reject;
  document.head.appendChild(script);
});

const TurnstileWidget = ({ onVerify, onExpire, onError, resetKey }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const siteKey = import.meta.env.VITE_SITE_KEY || import.meta.env.SITE_KEY;
  const isDevelopment = import.meta.env.MODE === 'development';

  useEffect(() => {
    // In development, immediately call onVerify with empty token to bypass Turnstile
    if (isDevelopment) {
      if (onVerify) {
        onVerify('');
      }
      return;
    }

    let isMounted = true;

    const renderWidget = async () => {
      if (!siteKey || !containerRef.current) {
        return;
      }
      try {
        await loadTurnstileScript();
        if (!isMounted || !window.turnstile) {
          return;
        }
        if (widgetIdRef.current !== null) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
        });
      } catch (err) {
        if (onError) {
          onError(err);
        }
      }
    };

    renderWidget();

    return () => {
      isMounted = false;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onExpire, onError, siteKey, resetKey, isDevelopment]);

  // Don't render anything in development or if no site key in production
  if (isDevelopment || !siteKey) {
    return null;
  }

  return <div className="flex justify-center" ref={containerRef} />;
};

export default TurnstileWidget;
