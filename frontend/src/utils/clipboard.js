/**
 * Clipboard and Wishlist Sharing Utilities
 */

/**
 * Copies plain text to clipboard with multi-tier fallback:
 * 1. Modern navigator.clipboard API (requires secure context)
 * 2. execCommand('copy') on temporary textarea (works in insecure context / HTTP / older browsers / iOS Safari)
 * Returns Promise<boolean> indicating success.
 */
export async function copyTextToClipboard(text) {
  if (!text) return false;

  // 1. Try modern navigator.clipboard if available and in secure context
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
    }
  }

  // 2. Fallback using execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent scrolling and viewport jumps on mobile/desktop
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0.01';
    textArea.style.fontSize = '16px'; // Prevent zoom on iOS

    // Crucial for iOS: don't use readonly attribute, as WebKit blocks selection on readonly inputs
    textArea.readOnly = false;

    document.body.appendChild(textArea);

    // Focus and select the text to ensure mobile browsers allow copy
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');

    document.body.removeChild(textArea);
    return Boolean(successful);
  } catch (err) {
    console.warn('execCommand fallback failed:', err);
    return false;
  }
}

/**
 * Checks if navigator.share is supported
 */
export function canShare(shareData) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (shareData && typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(shareData);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Shares text using native navigator.share if available
 */
export async function shareWishlistText({ title, text, url }) {
  const shareData = {
    title: title || 'Wishlist',
    text: text,
  };
  if (url) {
    shareData.url = url;
  }

  if (!canShare(shareData)) return false;

  try {
    await navigator.share(shareData);
    return true;
  } catch (err) {
    // User cancelled share or aborted
    if (err && err.name !== 'AbortError') {
      console.warn('navigator.share failed:', err);
    }
    return false;
  }
}

/**
 * Formats a list of wishlist items into human-readable plain text
 */
export function formatWishlistAsText(listName, items) {
  if (!items || items.length === 0) return '';

  let text = `Here is ${listName}:\n\n`;
  items.forEach((item) => {
    const title = item.title || item.name || 'Untitled Item';
    let line = `• ${title}`;

    if (item.price !== null && item.price !== undefined && !Number.isNaN(Number(item.price))) {
      const numPrice = Number(item.price);
      // In this app, item.price is stored in cents on backend (e.g. 2500 -> $25.00)
      if (numPrice > 0) {
        const formattedPrice = (numPrice / 100).toFixed(2);
        line += ` ($${formattedPrice})`;
      }
    }

    text += `${line}\n`;

    const desc = item.description || item.notes;
    if (desc && desc.trim()) {
      text += `  Notes: ${desc.trim()}\n`;
    }

    const link = item.link || item.url;
    if (link && link.trim()) {
      text += `  Link: ${link.trim()}\n`;
    }

    text += '\n';
  });

  return text.trim();
}
