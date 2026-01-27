/// <reference types="vite/client" />

declare global {
  interface Window {
    refreshBackups?: (force?: boolean) => void | Promise<void>;
    refreshWishlistItems?: (force?: boolean) => void | Promise<void>;
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (error?: unknown) => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export {};
