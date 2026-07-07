import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Globe, Search, BookOpen, Sparkles, Settings, X, Shield } from 'lucide-react';
import NotesTab from './components/NotesTab';
import AskAiTab from './components/AskAiTab';
import SettingsTab from './components/SettingsTab';
import CropOverlay from './components/CropOverlay';
import type { ApiKeys } from './utils/ai-providers';

type PanelType = 'notes' | 'ai' | 'settings';

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    // Migrate old single key if present
    const oldKey = localStorage.getItem('gemini_api_key');
    if (oldKey && !localStorage.getItem('api_key_gemini')) {
      localStorage.setItem('api_key_gemini', oldKey);
      localStorage.removeItem('gemini_api_key');
    }
    return {
      gemini: localStorage.getItem('api_key_gemini') || '',
      openai: localStorage.getItem('api_key_openai') || '',
      anthropic: localStorage.getItem('api_key_anthropic') || '',
    };
  });
  const [focusAskAiInput, setFocusAskAiInput] = useState<number>(0);
  const [screenshotTriggerTime, setScreenshotTriggerTime] = useState<number>(0);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);

  // Browser state
  const [urlInput, setUrlInput] = useState('https://www.google.com');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const [defaultAiProvider, setDefaultAiProvider] = useState<string>('');

  // Load configuration on mount
  useEffect(() => {
    async function loadConfig() {
      if (window.electronAPI) {
        const config = await window.electronAPI.getConfig();
        if (config) {
          if (config.blockedKeywords) setBlockedKeywords(config.blockedKeywords);
          if (config.defaultAiProvider) setDefaultAiProvider(config.defaultAiProvider);
        }
      }
    }
    loadConfig();

    // Listen to global shortcut trigger for Ask AI
    if (window.electronAPI) {
      const unsubAskAi = window.electronAPI.onGlobalAskAi(async () => {
        console.log('[FocusBro] Global Ask AI shortcut received!');
        
        let selectedText = '';
        const webview = webviewRef.current;
        
        // Try to read selected text from the browser webview
        if (webview) {
          try {
            selectedText = await webview.executeJavaScript('window.getSelection().toString()');
          } catch (err) {
            console.error('[FocusBro] Failed to read selection from webview:', err);
          }
        }

        if (selectedText && selectedText.trim().length > 0) {
          // === TEXT MODE ===
          // User has text selected → copy it to clipboard and open AI to paste
          console.log('[FocusBro] Text selected, copying to clipboard:', selectedText.substring(0, 50) + '...');
          try {
            if (window.electronAPI) {
              await window.electronAPI.writeTextToClipboard(selectedText.trim());
            } else {
              await navigator.clipboard.writeText(selectedText.trim());
            }
          } catch (err) {
            console.error('[FocusBro] Failed to write text to clipboard:', err);
          }
          // Open the AI panel and trigger auto-paste
          setActivePanel('ai');
          // Small delay to let the AI panel mount its webview before pasting
          setTimeout(() => {
            setScreenshotTriggerTime(Date.now());
            setFocusAskAiInput(prev => prev + 1);
          }, 300);
        } else {
          // === IMAGE MODE ===
          // No text selected → capture a screenshot of the page
          console.log('[FocusBro] No text selected, capturing screenshot...');
          if (webview) {
            try {
              const image = await webview.capturePage();
              setCropImage(image.toDataURL());
            } catch (err) {
              console.error('[FocusBro] Failed to capture page:', err);
              // Fallback: just open AI panel
              setActivePanel('ai');
              setFocusAskAiInput(prev => prev + 1);
            }
          } else {
            // No webview available, just open AI panel
            setActivePanel('ai');
            setFocusAskAiInput(prev => prev + 1);
          }
        }
      });

      return () => {
        unsubAskAi();
      };
    }
  }, []);

  // Webview event bindings
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onStartLoad = () => setIsLoading(true);
    const onStopLoad = () => {
      setIsLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const onNavigate = (e: any) => {
      setUrlInput(e.url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    webview.addEventListener('did-start-loading', onStartLoad);
    webview.addEventListener('did-stop-loading', onStopLoad);
    webview.addEventListener('did-navigate', onNavigate);
    webview.addEventListener('did-navigate-in-page', onNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', onStartLoad);
      webview.removeEventListener('did-stop-loading', onStopLoad);
      webview.removeEventListener('did-navigate', onNavigate);
      webview.removeEventListener('did-navigate-in-page', onNavigate);
    };
  }, [webviewRef.current]);

  // URL Navigation
  const navigateToUrl = (targetUrl: string) => {
    let url = targetUrl.trim();
    if (!url) return;

    const isUrl = /^(https?:\/\/)?([\\da-z.-]+)\\.([a-z.]{2,6})([/\\w .-]*)*\/?$/.test(url);
    if (!isUrl) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    if (webviewRef.current) {
      webviewRef.current.src = url;
    }
  };

  const togglePanel = (panel: PanelType) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  // Save blocked keywords to config
  const handleUpdateKeywords = async (newKeywords: string[]) => {
    setBlockedKeywords(newKeywords);
    if (window.electronAPI) {
      await window.electronAPI.saveConfig({ blockedKeywords: newKeywords });
    }
  };

  const handleUpdateDefaultAiProvider = async (provider: string) => {
    setDefaultAiProvider(provider);
    if (window.electronAPI) {
      await window.electronAPI.saveConfig({ defaultAiProvider: provider });
    }
  };

  // Save API Keys
  const handleSaveApiKeys = (keys: ApiKeys) => {
    setApiKeys(keys);
    localStorage.setItem('api_key_gemini', keys.gemini);
    localStorage.setItem('api_key_openai', keys.openai);
    localStorage.setItem('api_key_anthropic', keys.anthropic);
  };

  const panelTitle = activePanel === 'notes' ? 'Notes' : activePanel === 'ai' ? 'Ask AI' : 'Settings';

  return (
    <div className="app-container">
      {/* ===== Unified Toolbar ===== */}
      <div className="toolbar">
        {/* Brand */}
        <div className="toolbar-brand">
          <Shield size={18} strokeWidth={2.5} />
          <span>FocusBro</span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }} />

        {/* Navigation Buttons */}
        <div className="toolbar-nav">
          <button
            onClick={() => webviewRef.current?.goBack()}
            disabled={!canGoBack}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={() => webviewRef.current?.goForward()}
            disabled={!canGoForward}
            title="Forward"
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => webviewRef.current?.reload()}
            title="Reload"
          >
            <RotateCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>

        {/* URL / Search Bar */}
        <div className="toolbar-url">
          <div className="url-icon">
            {urlInput.startsWith('https://') ? (
              <Globe size={13} color="var(--color-success)" />
            ) : (
              <Search size={13} color="var(--color-text-dim)" />
            )}
          </div>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigateToUrl(urlInput)}
            placeholder="Search or enter web address..."
          />
          {isLoading && <div className="url-loading-bar" />}
        </div>

        {/* Feature Icons */}
        <div className="toolbar-features">
          <button
            className={activePanel === 'notes' ? 'active' : ''}
            onClick={() => togglePanel('notes')}
            data-tooltip="Notes"
          >
            <BookOpen size={15} />
          </button>
          <button
            className={activePanel === 'ai' ? 'active' : ''}
            onClick={() => togglePanel('ai')}
            data-tooltip="Ask AI"
          >
            <Sparkles size={15} />
          </button>
          <button
            className={activePanel === 'settings' ? 'active' : ''}
            onClick={() => togglePanel('settings')}
            data-tooltip="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ===== Loading Bar ===== */}
      {isLoading && (
        <div className="loading-bar-container">
          <div className="bar" />
        </div>
      )}

      {/* ===== Content Area ===== */}
      <div className="content-area" style={{ position: 'relative' }}>
        {/* @ts-ignore */}
        <webview
          ref={webviewRef}
          src="https://www.google.com"
          className="browser-webview"
        />

        {cropImage && (
          <CropOverlay
            imageUrl={cropImage}
            onCancel={() => setCropImage(null)}
            onCropComplete={async (croppedDataUrl) => {
              // Write image to system clipboard via main process IPC (reliable)
              try {
                if (window.electronAPI) {
                  await window.electronAPI.writeImageToClipboard(croppedDataUrl);
                  console.log('[FocusBro] Cropped image written to clipboard via IPC.');
                }
              } catch (err) {
                console.error('[FocusBro] Failed to write cropped image to clipboard:', err);
              }
              // Close crop overlay and open AI panel
              setCropImage(null);
              setActivePanel('ai');
              // Delay paste trigger to let AI panel & webview mount
              setTimeout(() => {
                setScreenshotTriggerTime(Date.now());
                setFocusAskAiInput(prev => prev + 1);
              }, 500);
            }}
          />
        )}

        {/* Floating Panel Overlay */}
        {activePanel && (
          <>
            <div className="panel-backdrop" onClick={() => setActivePanel(null)} />
            <div className="floating-panel">
              <div className="panel-header">
                <h3>{panelTitle}</h3>
                <button onClick={() => setActivePanel(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="panel-content">
                {activePanel === 'notes' && (
                  <div className="animate-fade-in" style={{ height: '100%' }}>
                    <NotesTab geminiKey={apiKeys.gemini} />
                  </div>
                )}
                {activePanel === 'ai' && (
                  <div className="animate-fade-in" style={{ height: '100%' }}>
                    <AskAiTab
                      focusAskAiInput={focusAskAiInput}
                      screenshotTriggerTime={screenshotTriggerTime}
                      shortcutAiProvider={defaultAiProvider}
                    />
                  </div>
                )}
                {activePanel === 'settings' && (
                  <div className="animate-fade-in" style={{ height: '100%' }}>
                    <SettingsTab
                      blockedKeywords={blockedKeywords}
                      onUpdateKeywords={handleUpdateKeywords}
                      apiKeys={apiKeys}
                      onSaveApiKeys={handleSaveApiKeys}
                      defaultAiProvider={defaultAiProvider}
                      onUpdateDefaultAiProvider={handleUpdateDefaultAiProvider}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
