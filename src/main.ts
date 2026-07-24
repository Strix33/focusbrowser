import { app, BrowserWindow, ipcMain, globalShortcut, protocol, net, webContents, session, desktopCapturer, clipboard, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { ElectronBlocker } from '@ghostery/adblocker-electron';

// Register custom protocol for local files (images of notes) before app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'focusbro-file', privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true } }
]);

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let blocker: any = null;

// Paths for local storage
const userDataPath = app.getPath('userData');
const notesFilePath = path.join(userDataPath, 'notes.json');
const notesImagesDir = path.join(userDataPath, 'note_images');
const configFilePath = path.join(userDataPath, 'config.json');

// Ensure directories exist
if (!fs.existsSync(notesImagesDir)) {
  fs.mkdirSync(notesImagesDir, { recursive: true });
}

// In-memory config store
let appConfig = {
  blockedKeywords: [] as string[],
  defaultAiProvider: '',
  totalStudySeconds: 0
};

// Load config
if (fs.existsSync(configFilePath)) {
  try {
    appConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  } catch (err) {
    console.error('Error loading config', err);
  }
}


const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Crucial for embedding the YouTube/Browser view
      sandbox: false, // Required for Node.js modules in preload
    },
  });

  // Enable Ghostery network-level ad blocker on the default session.
  // This intercepts and blocks ad-serving HTTP requests BEFORE they reach the page,
  // exactly like Brave browser does. uBlock is removed because Electron webview
  // doesn't reliably pass extension contexts to webview guest pages.
  if (blocker) {
    blocker.enableBlockingInSession(session.defaultSession);
    console.log('[FocusBro] Ghostery ad-blocker enabled on defaultSession.');
  }

  // Additional network-level blocking: manually intercept YouTube ad-serving URLs
  // that Ghostery's filter lists might miss.
  const adUrlPatterns = [
    '*://googleads.g.doubleclick.net/*',
    '*://pagead2.googlesyndication.com/*',
    '*://www.youtube.com/api/stats/ads*',
    '*://www.youtube.com/pagead/*',
    '*://www.youtube.com/ptracking*',
    '*://www.youtube.com/get_midroll_info*',
    '*://yt3.ggpht.com/*/ad_*',
    '*://static.doubleclick.net/*',
    '*://ad.doubleclick.net/*',
    '*://www.googleadservices.com/*',
    '*://tpc.googlesyndication.com/*',
  ];
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: adUrlPatterns },
    (details, callback) => {
      console.log(`[FocusBro] Blocked ad request: ${details.url.substring(0, 120)}`);
      callback({ cancel: true });
    }
  );

  // Load front-end URL
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools (uncomment for debugging)
  // mainWindow.webContents.openDevTools();

  // Log renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Register the global shortcut for Ask AI (Ctrl + Shift + Space)
  const shortcutRegistered = globalShortcut.register('Ctrl+Shift+Space', () => {
    console.log('[FocusBro] Global shortcut Ctrl+Shift+Space triggered!');
    if (mainWindow) {
      // Read selected text from system clipboard (user may have selected text)
      const clipboardText = clipboard.readText();
      
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      // Send IPC trigger to the React frontend
      mainWindow.webContents.send('global-ask-ai');
    }
  });
  
  if (!shortcutRegistered) {
    console.error('[FocusBro] Failed to register Ctrl+Shift+Space shortcut! Another app may have claimed it.');
  } else {
    console.log('[FocusBro] Successfully registered Ctrl+Shift+Space shortcut.');
  }


  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Setup URL Interception and Injection for YouTube/Google webview
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    // Also enable the Ghostery blocker on this specific webContents' session
    // in case the webview uses a partition or non-default session.
    if (blocker) {
      blocker.enableBlockingInSession(contents.session);
    }

    // Open DevTools for debugging the webview guest page (uncomment for debugging)
    // contents.openDevTools();

    // Pipe webview console logs to the terminal
    contents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[Webview Console] ${message}`);
    });

    // Intercept navigation to shorts and convert to normal video URLs
    contents.on('will-navigate', (navEvent, url) => {
      if (url.includes('youtube.com/shorts/')) {
        const parts = url.split('/shorts/');
        const videoId = parts[1]?.split('?')[0];
        if (videoId) {
          navEvent.preventDefault();
          contents.loadURL(`https://www.youtube.com/watch?v=${videoId}`);
        }
      }
    });

    contents.on('will-redirect', (redirectEvent, url) => {
      if (url.includes('youtube.com/shorts/')) {
        const parts = url.split('/shorts/');
        const videoId = parts[1]?.split('?')[0];
        if (videoId) {
          redirectEvent.preventDefault();
          contents.loadURL(`https://www.youtube.com/watch?v=${videoId}`);
        }
      }
    });

    // BRAVE-LIKE AD BLOCKER: Strip ad data from YouTube's JSON API responses
    // before the player can parse and play them.
    contents.on('did-commit-navigation' as any, (event: any, url: any) => {
      if (url.includes('youtube.com')) {
        contents.executeJavaScript(`
          (function() {
            if (window.__focusBroAdHookInjected) return;
            window.__focusBroAdHookInjected = true;
            console.log("[FocusBro] Injecting Brave-level AdBlock hooks...");

            // === LAYER 1: Strip ad payloads from all JSON.parse calls ===
            const originalParse = JSON.parse;
            const adKeys = ['adPlacements','playerAds','adSlots','instreamVideoAdRenderer','adBreakServiceRenderer'];
            function deepStripAds(obj) {
              if (!obj || typeof obj !== 'object') return obj;
              for (const key of adKeys) {
                if (key in obj) { delete obj[key]; }
              }
              // Strip from nested playerResponse
              if (obj.playerResponse) {
                let pr = obj.playerResponse;
                if (typeof pr === 'string') { try { pr = originalParse(pr); } catch(e) { return obj; } }
                for (const key of adKeys) { if (key in pr) delete pr[key]; }
                obj.playerResponse = typeof obj.playerResponse === 'string' ? JSON.stringify(pr) : pr;
              }
              if (obj.response) {
                for (const key of adKeys) { if (key in obj.response) delete obj.response[key]; }
              }
              return obj;
            }
            JSON.parse = function() {
              let result = originalParse.apply(this, arguments);
              try { result = deepStripAds(result); } catch(e) {}
              return result;
            };

            // === LAYER 2: Remove property traps as they cause recursion / range errors on Polymer ===
            // (JSON.parse and fetch interceptions handle the ad blocking perfectly)

            // === LAYER 3: Intercept fetch/XHR to strip ad data from API responses ===
            const origFetch = window.fetch;
            window.fetch = async function() {
              const response = await origFetch.apply(this, arguments);
              try {
                const url = (arguments[0] instanceof Request) ? arguments[0].url : String(arguments[0]);
                if (url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next')) {
                  const clone = response.clone();
                  const body = await clone.json();
                  deepStripAds(body);
                  return new Response(JSON.stringify(body), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                  });
                }
              } catch(e) {}
              return response;
            };

            console.log("[FocusBro] All ad-block hooks installed.");
          })();
        `).catch(err => console.error("Failed to inject JSON AdBlock hook:", err));
      }
    });

    // Inject CSS to hide shorts and JS to filter feed/keywords on dom-ready
    contents.on('dom-ready', () => {
      const currentUrl = contents.getURL();
      console.log(`[FocusBro] dom-ready triggered on: ${currentUrl}`);

      if (!currentUrl.includes('youtube.com')) {
        console.log("[FocusBro] Not YouTube, skipping injection.");
        return;
      }

      console.log("[FocusBro] Injecting YouTube Shorts blocker and keyword filter!");

      // 1. Inject CSS robustly at the Electron level to hide shorts components
      const shortsCSS = `
        /* Hide all videos with the shorts indicator */
        ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
        ytd-grid-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
        ytd-rich-item-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),

        /* Remove generic shorts shelf */
        ytd-reel-shelf-renderer,

        /* Remove rich shelf shorts section */
        ytd-rich-shelf-renderer[is-shorts],
        ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
        ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model),

        /* Hide shorts button in sidebar */
        ytd-guide-entry-renderer:has([title="Shorts"]),
        ytd-mini-guide-entry-renderer:has([title="Shorts"]),

        /* Hide shorts tab on channel pages */
        yt-tab-shape[tab-title="Shorts"],

        /* Hide shorts filter/category on top of homepage and search pages */
        yt-chip-cloud-chip-renderer:has(yt-formatted-string[title="Shorts"]),

        /* Hide shorts sections on search page */
        grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2),
        grid-shelf-view-model:has(ytm-shorts-lockup-view-model),

        /* Additional catch-alls for Shorts */
        a[href^="/shorts/"],
        ytd-shorts,
        #shorts-container {
          display: none !important;
        }
      `;
      contents.insertCSS(shortsCSS).catch(err => console.error("Failed to insert Shorts CSS:", err));

      // 2. Inject JS to handle keyword filtering and dynamic DOM observing
      const jsCode = `
        (function() {
          console.log("[FocusBro] Injecting keyword filter!");

          // 2. Keyword Filtering
          let blockedKeywords = ${JSON.stringify(appConfig.blockedKeywords)};
          
          var VIDEO_SELECTORS = [
              'ytd-rich-item-renderer',
              'ytd-video-renderer',
              'ytd-compact-video-renderer',
              'ytd-grid-video-renderer',
              'ytd-reel-video-renderer'
          ];

          function isExplicitBrowsing() {
            var path = window.location.pathname;
            // Search results = user explicitly searched for something
            if (path === '/results' || path.startsWith('/results')) return true;
            // Hashtag pages = user clicked a hashtag
            if (path.startsWith('/hashtag/')) return true;
            return false;
          }

          function restoreAllBlocked() {
            VIDEO_SELECTORS.forEach(function(selector) {
              document.querySelectorAll(selector).forEach(function(item) {
                if (item.dataset.blockedByFocusbro === 'true') {
                  item.style.display = '';
                  delete item.dataset.blockedByFocusbro;
                }
              });
            });
          }

          // Recursively extract all text content from a DOM node and all its shadow roots
          function getTextDeep(node) {
            if (!node) return "";
            if (node.nodeType === 3) { // Node.TEXT_NODE
              return node.nodeValue || "";
            }
            var text = "";
            if (node.shadowRoot) {
              text += " " + getTextDeep(node.shadowRoot);
            }
            if (node.childNodes && node.childNodes.length > 0) {
              for (var i = 0; i < node.childNodes.length; i++) {
                text += " " + getTextDeep(node.childNodes[i]);
              }
            }
            return text;
          }

          function filterFeed() {
            // Don't filter on search results - user is explicitly searching
            if (isExplicitBrowsing()) {
              restoreAllBlocked();
              return;
            }

            // If no keywords configured, make sure everything is visible
            if (!blockedKeywords || blockedKeywords.length === 0) {
              restoreAllBlocked();
              return;
            }

            VIDEO_SELECTORS.forEach(function(selector) {
              var items = document.querySelectorAll(selector);
              items.forEach(function(item) {
                // Extract all text content including shadow DOM
                var combinedText = getTextDeep(item).toLowerCase().trim();
                if (!combinedText) return;
                
                var shouldBlock = blockedKeywords.some(function(keyword) {
                  if (!keyword || !keyword.trim()) return false;
                  var kw = keyword.trim().toLowerCase();
                  var match = combinedText.includes(kw);
                  if (match) {
                    console.log("[FocusBro Diagnostic] Blocked item matching keyword: '" + kw + "' (text found: '" + combinedText.substring(0, 100) + "...')");
                  }
                  return match;
                });
                
                if (shouldBlock) {
                  item.style.display = 'none';
                  item.dataset.blockedByFocusbro = 'true';
                } else if (item.dataset.blockedByFocusbro === 'true') {
                  // Only restore items WE previously blocked
                  item.style.display = '';
                  delete item.dataset.blockedByFocusbro;
                }
              });
            });
          }

          // Global callback to update keywords
          window.updateKeywords = function(newKeywords) {
            blockedKeywords = newKeywords;
            filterFeed();
          };

          // Intercept clicks on links that lead to Shorts
          document.addEventListener('click', (event) => {
            const target = event.target;
            const anchor = target.closest('a');
            if (anchor && anchor.href && anchor.href.includes('/shorts/')) {
              const parts = anchor.href.split('/shorts/');
              const videoId = parts[1]?.split('?')[0];
              if (videoId) {
                event.preventDefault();
                event.stopPropagation();
                window.location.href = 'https://www.youtube.com/watch?v=' + videoId;
              }
            }
          }, true);

          // 3. ZERO-VISIBILITY Ad Killer (failsafe if network blocking misses something)
          // Unlike the old approach that fast-forwarded (making ads visible), this
          // completely hides the player during ad, skips instantly, and restores.
          console.log("[FocusBro] Injecting Zero-Visibility Ad Killer...");

          // Inject CSS to completely hide ads the moment they appear
          const adHideStyle = document.createElement('style');
          adHideStyle.textContent = [
            // Hide the video player overlay ads
            '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout,',
            '.ytp-ad-overlay-container, .ytp-ad-text-overlay,',
            '.ytp-ad-overlay-slot, .ytp-ad-image-overlay,',
            // Hide companion / banner ads
            'ytd-banner-promo-renderer, ytd-player-legacy-desktop-watch-ads-renderer,',
            'ytd-action-companion-ad-renderer, ytd-ad-slot-renderer,',
            '#player-ads, .ytd-in-feed-ad-layout-renderer,',
            'ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,',
            'ytd-promoted-video-renderer, ytd-in-feed-ad-layout-renderer,',
            // Hide "Ad" badge and ad info
            '.ytp-ad-badge, .ytp-ad-visit-advertiser-button,',
            '.ytp-ad-button, .ytp-ad-preview-container,',
            '.ytp-ad-skip-button-slot,',
            // Hide the ad countdown text
            '.ytp-ad-text, .ytp-ad-simple-ad-badge,',
            '.video-ads, #masthead-ad',
            '{ display: none !important; visibility: hidden !important; height: 0 !important; }'
          ].join(' ');
          document.head.appendChild(adHideStyle);

          // Ultra-fast ad killer loop: check every 50ms
          let wasAdPlaying = false;
          setInterval(() => {
            const player = document.querySelector('.html5-video-player');
            if (!player) return;
            const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
            const video = document.querySelector('video');

            if (isAd && video) {
              // Hide video element entirely so user sees nothing
              if (!wasAdPlaying) {
                video.style.opacity = '0';
                video.style.pointerEvents = 'none';
                wasAdPlaying = true;
              }
              // Mute and skip to the very end
              video.muted = true;
              video.playbackRate = 16; // maximum speed
              if (!isNaN(video.duration) && video.duration > 0) {
                video.currentTime = video.duration;
              }
              // Click ALL possible skip buttons immediately
              const skipSelectors = [
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-modern',
                '.ytp-skip-ad-button',
                '.ytp-ad-skip-button-slot button',
                '.ytp-ad-overlay-close-button',
                'button.ytp-ad-skip-button-modern',
                '.ytp-ad-skip-button-container button',
              ];
              skipSelectors.forEach(sel => {
                const btns = document.querySelectorAll(sel);
                btns.forEach(btn => {
                  try { btn.click(); } catch(e) {}
                });
              });
            } else if (wasAdPlaying && video) {
              // Ad is gone — restore video visibility
              video.style.opacity = '1';
              video.style.pointerEvents = '';
              video.muted = false;
              wasAdPlaying = false;
            }

            // Also nuke overlay / companion ads from the DOM
            const overlayAds = document.querySelectorAll('.ytp-ad-overlay-container, .ytp-ad-overlay-slot');
            overlayAds.forEach(el => el.remove());
          }, 50); // 50ms — near instant detection

          // 4. MutationObserver for Keyword Filtering
          if (window.feedObserver) {
            window.feedObserver.disconnect();
          }
          // Debounce the observer to avoid excessive filtering on rapid DOM changes
          var filterTimeout = null;
          window.feedObserver = new MutationObserver(function() {
            if (filterTimeout) clearTimeout(filterTimeout);
            filterTimeout = setTimeout(filterFeed, 150);
          });
          window.feedObserver.observe(document.body, { childList: true, subtree: true });

          // 5. YouTube SPA Navigation Detection
          // YouTube uses client-side navigation (no full page reloads), so we
          // listen for navigation events to re-evaluate filtering on page changes
          var lastFilterUrl = window.location.href;

          // YouTube fires this custom event after SPA navigation completes
          window.addEventListener('yt-navigate-finish', function() {
            console.log('[FocusBro] yt-navigate-finish detected, re-filtering...');
            setTimeout(filterFeed, 300);
          });

          // Browser back/forward navigation
          window.addEventListener('popstate', function() {
            setTimeout(filterFeed, 300);
          });

          // Fallback: periodic URL change check for any missed navigations
          if (window.focusbroUrlChecker) clearInterval(window.focusbroUrlChecker);
          window.focusbroUrlChecker = setInterval(function() {
            if (window.location.href !== lastFilterUrl) {
              lastFilterUrl = window.location.href;
              console.log('[FocusBro] URL change detected, re-filtering...');
              filterFeed();
            }
          }, 1000);

          // Run initial filter
          filterFeed();
        })();
      `;
      contents.executeJavaScript(jsCode).catch((err) => {
        console.error('Error executing JS in webview:', err);
      });
    });
  }
});

// Initialize protocol and setup app lifecycle
app.whenReady().then(async () => {
  // Register file serving protocol
  protocol.handle('focusbro-file', (request) => {
    const url = request.url.slice('focusbro-file://'.length);
    const decodedPath = decodeURIComponent(url);
    return net.fetch(`file://${decodedPath}`);
  });

  // Pre-load blocker before creating the window to guarantee it is ready for the webviews
  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    console.log('Ad-blocker pre-loaded successfully.');
  } catch (error) {
    console.error('Error pre-loading adblocker:', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- IPC HANDLERS ---

// Get Notes
ipcMain.handle('get-notes', () => {
  if (!fs.existsSync(notesFilePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(notesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading notes', err);
    return [];
  }
});

// Save Notes
ipcMain.handle('save-notes', (event, notes) => {
  try {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing notes', err);
    return false;
  }
});

// Save image of note
ipcMain.handle('save-note-image', (event, fileBuffer, fileName) => {
  try {
    const filePath = path.join(notesImagesDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    // Return custom protocol path
    return `focusbro-file://${filePath.replace(/\\/g, '/')}`;
  } catch (err) {
    console.error('Error saving note image', err);
    return null;
  }
});

// Get Config
ipcMain.handle('get-config', () => {
  return appConfig;
});

// Save Config
ipcMain.handle('save-config', (event, newConfig) => {
  try {
    appConfig = { ...appConfig, ...newConfig };
    fs.writeFileSync(configFilePath, JSON.stringify(appConfig, null, 2), 'utf8');
    
    // Broadcast keywords to all guest webview webContents
    const allWebContents = webContents.getAllWebContents();
    allWebContents.forEach(contents => {
      if (contents.getType() === 'webview') {
        const jsCode = `
          if (typeof window.updateKeywords === 'function') {
            window.updateKeywords(${JSON.stringify(appConfig.blockedKeywords)});
          }
        `;
        contents.executeJavaScript(jsCode).catch(err => {
          // Ignore failures on non-loaded pages
        });
      }
    });
    return true;
  } catch (err) {
    console.error('Error saving config', err);
    return false;
  }
});

// Write image to system clipboard (used by crop overlay)
ipcMain.handle('write-image-to-clipboard', (event, dataUrl: string) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(image);
    console.log('[FocusBro] Cropped image written to system clipboard via IPC.');
    return true;
  } catch (err) {
    console.error('Error writing image to clipboard:', err);
    return false;
  }
});

// Write text to system clipboard
ipcMain.handle('write-text-to-clipboard', (event, text: string) => {
  try {
    clipboard.writeText(text);
    console.log('[FocusBro] Text written to system clipboard via IPC.');
    return true;
  } catch (err) {
    console.error('Error writing text to clipboard:', err);
    return false;
  }
});

// Resolve rank video file path from rank system directory
ipcMain.handle('get-rank-video-url', (event, fileName: string) => {
  try {
    const candidates = [
      path.join(process.cwd(), 'rank system', fileName),
      path.join(app.getAppPath(), 'rank system', fileName),
      path.join(process.cwd(), 'rank system', 'iron.mp4'),
      path.join(app.getAppPath(), 'rank system', 'iron.mp4'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return `focusbro-file://${p.replace(/\\/g, '/')}`;
      }
    }
  } catch (err) {
    console.error('Error getting rank video url:', err);
  }
  return null;
});
