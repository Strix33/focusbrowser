import { ipcRenderer } from 'electron';

// Inject CSS to hide Shorts components from YouTube interface
function injectShortsHiderCSS() {
  if (!window.location.hostname.includes('youtube.com')) return;

  const styleId = 'focusbro-shorts-hider-style';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Hide Shorts button in left sidebar (expanded and mini) */
    ytd-guide-entry-renderer:has(a[href*="/shorts"]),
    ytd-mini-guide-entry-renderer[aria-label="Shorts"],
    ytd-guide-entry-renderer[title="Shorts"],
    a[path="shorts"],
    #items ytd-guide-entry-renderer:nth-child(2), /* Fallback for sidebar */
    
    /* Hide Shorts shelves on Homepage */
    ytd-rich-shelf-renderer[is-shorts],
    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
    
    /* Hide Shorts sections in Search Results */
    ytd-reel-shelf-renderer,
    
    /* Hide Shorts tab on channel pages */
    yt-tab-shape[tab-title="Shorts"],
    tp-yt-paper-tab:has(div[class*="tab-content"]):contains("Shorts") {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Intercept clicks on links that lead to Shorts
function setupShortsNavigationInterceptor() {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      const url = anchor.href;
      if (url.includes('/shorts/')) {
        const videoId = url.split('/shorts/')[1]?.split('?')[0];
        if (videoId) {
          event.preventDefault();
          event.stopPropagation();
          // Redirect to watch form
          window.location.href = `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
    }
  }, true);
}

// Handle initialization and observers
function init() {
  // Inject CSS
  injectShortsHiderCSS();
  setupShortsNavigationInterceptor();

  // Setup Observer to re-inject CSS in case DOM gets rebuilt
  const observer = new MutationObserver(() => {
    injectShortsHiderCSS();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}


// Wait for DOM to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
