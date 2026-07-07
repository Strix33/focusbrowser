import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface AskAiTabProps {
  focusAskAiInput: number;
  screenshotTriggerTime: number;
  shortcutAiProvider?: string;
}

type AIProvider = 'duckduckgo' | 'chatgpt' | 'claude' | 'gemini';

interface ProviderMeta {
  id: AIProvider;
  name: string;
  url: string;
  color: string;
  bgColor: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo Chat',
    url: 'https://duckduckgo.com/chat',
    color: '#de5833',
    bgColor: 'rgba(222, 88, 51, 0.1)',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    color: '#10a37f',
    bgColor: 'rgba(16, 163, 127, 0.1)',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.1)',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    color: '#1a73e8',
    bgColor: 'rgba(26, 115, 232, 0.1)',
  }
];

export default function AskAiTab({ focusAskAiInput, screenshotTriggerTime, shortcutAiProvider }: AskAiTabProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem('focusbro_ai_provider') as AIProvider) || 'duckduckgo';
  });
  const [isWebviewLoading, setIsWebviewLoading] = useState(true);

  const webviewRef = useRef<any>(null);

  // Persist provider selection
  const handleProviderChange = (providerId: AIProvider) => {
    setSelectedProvider(providerId);
    localStorage.setItem('focusbro_ai_provider', providerId);
    setIsWebviewLoading(true);
  };

  // Focus webview on global focus trigger
  useEffect(() => {
    if (focusAskAiInput > 0 && webviewRef.current) {
      webviewRef.current.focus();
    }
  }, [focusAskAiInput]);

  // Handle auto-pasting from clipboard when trigger time changes
  useEffect(() => {
    if (screenshotTriggerTime > 0 && webviewRef.current) {
      let currentLoadingState = isWebviewLoading;
      if (shortcutAiProvider && shortcutAiProvider !== selectedProvider) {
        handleProviderChange(shortcutAiProvider as AIProvider);
        currentLoadingState = true;
      }

      const webview = webviewRef.current;

      const attemptPaste = async (retriesLeft: number = 10) => {
        try {
          if (!webviewRef.current) return;
          const wv = webviewRef.current;

          // 1. Focus the webview
          wv.focus();

          // 2. Inject script to find and focus the text input box
            const focusScript = `
              (function() {
                const selectors = [
                  '#prompt-textarea',
                  'rich-textarea',
                  '[placeholder*="Ask anything"]',
                  '[placeholder*="Ask"]',
                  '[contenteditable="true"]',
                  'textarea',
                  'input[type="text"]',
                  '.ProseMirror',
                  '[data-placeholder]',
                  '.ql-editor'
                ];

                function findElement(root) {
                  for (const sel of selectors) {
                    try {
                      const el = root.querySelector(sel);
                      if (el) return el;
                    } catch(e) {}
                  }
                  
                  // Search inside shadow DOMs
                  const allNodes = root.querySelectorAll('*');
                  for (let i = 0; i < allNodes.length; i++) {
                    if (allNodes[i].shadowRoot) {
                      const found = findElement(allNodes[i].shadowRoot);
                      if (found) return found;
                    }
                  }
                  return null;
                }

                let el = findElement(document);
                
                if (el) {
                  // If we found a rich-textarea (Gemini), try to get its inner editable element
                  if (el.tagName && el.tagName.toLowerCase() === 'rich-textarea') {
                    const inner = el.querySelector('[contenteditable="true"]') || el.querySelector('p') || el.querySelector('div');
                    if (inner) el = inner;
                  }
                  
                  // Get coordinates for realistic click
                  const rect = el.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const opts = { bubbles: true, clientX: cx, clientY: cy };
                  
                  el.focus();
                  el.dispatchEvent(new PointerEvent('pointerdown', opts));
                  el.dispatchEvent(new MouseEvent('mousedown', opts));
                  el.dispatchEvent(new PointerEvent('pointerup', opts));
                  el.dispatchEvent(new MouseEvent('mouseup', opts));
                  el.dispatchEvent(new MouseEvent('click', opts));
                  el.dispatchEvent(new Event('focus', { bubbles: true }));
                  return el.tagName;
                }
                return null;
              })();
            `;
          const foundSelector = await wv.executeJavaScript(focusScript);
          console.log('[FocusBro] Focus target found:', foundSelector);

          if (!foundSelector && retriesLeft > 0) {
            // Input not found yet — page may still be loading, retry after delay
            console.log(`[FocusBro] Input not found, retrying... (${retriesLeft} left)`);
            setTimeout(() => attemptPaste(retriesLeft - 1), 800);
            return;
          }

          // 3. Trigger paste action with delay for the page to register focus
          setTimeout(() => {
            if (webviewRef.current) {
              webviewRef.current.focus(); // Ensure the webview itself is focused at the OS level
              webviewRef.current.paste();
              console.log('[FocusBro] Paste triggered on AI webview.');
            }
          }, 300);
        } catch (err) {
          console.error('[FocusBro] Failed to execute webview paste:', err);
          if (retriesLeft > 0) {
            setTimeout(() => attemptPaste(retriesLeft - 1), 800);
          }
        }
      };

      // Wait for webview to be ready before attempting paste
      let fallbackTimeoutId: any;
      const onStopLoading = () => {
        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        webview.removeEventListener('did-stop-loading', onStopLoading);
        // Give the page a moment to render its input fields
        setTimeout(() => attemptPaste(10), 500);
      };

      // Check if the webview already loaded
      if (!currentLoadingState) {
        setTimeout(() => attemptPaste(10), 300);
      } else {
        webview.addEventListener('did-stop-loading', onStopLoading);
        // Fallback timeout in case did-stop-loading already fired
        fallbackTimeoutId = setTimeout(() => {
          webview.removeEventListener('did-stop-loading', onStopLoading);
          attemptPaste(10);
        }, 5000);
      }
    }
  }, [screenshotTriggerTime]);

  // Setup loading state listeners
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onStartLoad = () => setIsWebviewLoading(true);
    const onStopLoad = () => setIsWebviewLoading(false);

    webview.addEventListener('did-start-loading', onStartLoad);
    webview.addEventListener('did-stop-loading', onStopLoad);

    return () => {
      webview.removeEventListener('did-start-loading', onStartLoad);
      webview.removeEventListener('did-stop-loading', onStopLoad);
    };
  }, [selectedProvider]);

  const activeProviderMeta = PROVIDERS.find(p => p.id === selectedProvider)!;

  return (
    <div style={styles.container}>
      {/* Top Provider Bar */}
      <div style={styles.providerBar}>
        <div style={styles.pillsContainer}>
          {PROVIDERS.map(p => {
            const isSelected = selectedProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                style={{
                  ...styles.providerPill,
                  backgroundColor: isSelected ? p.bgColor : 'transparent',
                  border: `1.5px solid ${isSelected ? p.color + '60' : 'rgba(255, 255, 255, 0.06)'}`,
                  color: isSelected ? p.color : '#6b7280',
                  fontWeight: isSelected ? 600 : 400,
                  boxShadow: isSelected ? `0 0 12px ${p.color}15` : 'none',
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        
        {/* Reload button */}
        <button
          onClick={() => webviewRef.current?.reload()}
          style={styles.reloadButton}
          title="Reload AI page"
        >
          <RefreshCw size={14} className={isWebviewLoading ? 'spin' : ''} />
        </button>
      </div>

      {/* Info Tip Banner */}
      <div style={styles.tipBanner}>
        <AlertCircle size={14} style={{ marginRight: '6px', color: activeProviderMeta.color }} />
        <span>
          Press <kbd style={styles.kbd}>Ctrl + Shift + Space</kbd> to auto-paste. Text selected → pastes text. No selection → captures screenshot.
        </span>
      </div>

      {/* Webview Wrapper */}
      <div style={styles.webviewContainer}>
        {/* @ts-ignore */}
        <webview
          ref={webviewRef}
          src={activeProviderMeta.url}
          style={styles.webview}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0f111a',
  },
  providerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0a0b10',
  },
  pillsContainer: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto' as const,
    flex: 1,
    paddingBottom: '2px',
  },
  providerPill: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  reloadButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    }
  },
  tipBanner: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#1b1d28',
    color: '#9ca3af',
    padding: '6px 14px',
    fontSize: '10px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  kbd: {
    fontFamily: 'monospace',
    padding: '2px 4px',
    backgroundColor: '#0a0b10',
    border: '1px solid #4b5563',
    borderRadius: '4px',
    fontSize: '9px',
    color: '#ffffff',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },
  webview: {
    width: '100%',
    height: '100%',
    border: 'none',
  }
};
