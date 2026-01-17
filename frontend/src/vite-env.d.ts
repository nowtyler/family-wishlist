/// <reference types="vite/client" />

declare global {
  interface Window {
    refreshBackups?: (force?: boolean) => void | Promise<void>;
    refreshWishlistItems?: (force?: boolean) => void | Promise<void>;
  }
}

export {};
