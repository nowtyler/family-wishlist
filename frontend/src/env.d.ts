/// <reference types="vite/client" />

interface RuntimeEnv {
  mode?: string;
  siteKey?: string;
}

interface Window {
  __RUNTIME_ENV__?: RuntimeEnv;
  turnstile?: {
    render: (container: HTMLElement, options: {
      sitekey: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: (error: any) => void;
    }) => string;
    remove: (widgetId: string) => void;
  };
}
