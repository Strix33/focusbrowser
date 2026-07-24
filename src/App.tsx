import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Globe, Search, BookOpen, Sparkles, Settings, X, Shield, Trophy, Award, Flame } from 'lucide-react';
import NotesTab from './components/NotesTab';
import AskAiTab from './components/AskAiTab';
import SettingsTab from './components/SettingsTab';
import RankTab from './components/RankTab';
import CropOverlay from './components/CropOverlay';
import type { ApiKeys } from './utils/ai-providers';
import { getRankProgressInfo, formatStudyTime } from './utils/rank-system';
import { classifyContent, ClassificationResult } from './utils/content-classifier';

type PanelType = 'notes' | 'ai' | 'settings' | 'rank';

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>([]);
  const [totalStudySeconds, setTotalStudySeconds] = useState<number>(0);
  const [currentClassification, setCurrentClassification] = useState<ClassificationResult | null>(null);
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
          if (typeof config.totalStudySeconds === 'number') {
            setTotalStudySeconds(config.totalStudySeconds);
          } else {
            // Check fallback in localStorage
            const savedSec = localStorage.getItem('focusbro_total_study_seconds');
            if (savedSec) setTotalStudySeconds(parseInt(savedSec, 10));
          }
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
          setActivePanel('ai');
          setTimeout(() => {
            setScreenshotTriggerTime(Date.now());
            setFocusAskAiInput(prev => prev + 1);
          }, 300);
        } else {
          // === IMAGE MODE ===
          console.log('[FocusBro] No text selected, capturing screenshot...');
          if (webview) {
            try {
              const image = await webview.capturePage();
              setCropImage(image.toDataURL());
            } catch (err) {
              console.error('[FocusBro] Failed to capture page:', err);
              setActivePanel('ai');
              setFocusAskAiInput(prev => prev + 1);
            }
          } else {
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

  // Real-time active study tracker (1s interval)
  useEffect(() => {
    const interval = setInterval(() => {
      const webview = webviewRef.current;
      if (!webview) return;

      try {
        const currentUrl = webview.getURL() || urlInput;
        const currentTitle = webview.getTitle() || '';

        const classification = classifyContent(currentUrl, currentTitle);
        setCurrentClassification(classification);

        if (classification.isStudy) {
          setTotalStudySeconds(prev => {
            const nextSec = prev + 1;
            // Save to localStorage immediately as fast backup
            localStorage.setItem('focusbro_total_study_seconds', nextSec.toString());
            return nextSec;
          });
        }
      } catch (err) {
        // Ignore iframe/webview load errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [urlInput]);

  // Periodic persist of study seconds to Electron config file (every 10s)
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (window.electronAPI) {
        window.electronAPI.saveConfig({ totalStudySeconds });
      }
    }, 10000);

    return () => clearInterval(saveInterval);
  }, [totalStudySeconds]);

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

    const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(url);
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

  const handleUpdateStudySeconds = (newSeconds: number) => {
    setTotalStudySeconds(newSeconds);
    localStorage.setItem('focusbro_total_study_seconds', newSeconds.toString());
    if (window.electronAPI) {
      window.electronAPI.saveConfig({ totalStudySeconds: newSeconds });
    }
  };

  const hours = totalStudySeconds / 3600;
  const rankInfo = getRankProgressInfo(hours);

  const panelTitle =
    activePanel === 'notes'
      ? 'Notes'
      : activePanel === 'ai'
      ? 'Ask AI'
      : activePanel === 'rank'
      ? 'Rank Progression'
      : 'Settings';

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

        {/* Topbar Mini Rank Badge */}
        <button
          className={`mini-rank-pill ${activePanel === 'rank' ? 'active' : ''}`}
          onClick={() => togglePanel('rank')}
          title="Click to view Rank Progression"
          style={{ '--pill-color': rankInfo.currentRank.badgeColor } as React.CSSProperties}
        >
          <div className="mini-rank-icon" style={{ background: rankInfo.currentRank.badgeGradient }}>
            <Trophy size={11} color="#FFF" />
          </div>
          <div className="mini-rank-info">
            <span className="mini-rank-name">{rankInfo.currentRank.name}</span>
            <div className="mini-rank-progress-track">
              <div
                className="mini-rank-progress-fill"
                style={{
                  width: `${rankInfo.progressPercent}%`,
                  background: rankInfo.currentRank.badgeGradient
                }}
              />
            </div>
          </div>
          {currentClassification?.isStudy && (
            <span className="mini-rank-active-dot" title="Study Session Active (+XP)" />
          )}
        </button>

        {/* Feature Icons */}
        <div className="toolbar-features">
          <button
            className={activePanel === 'rank' ? 'active' : ''}
            onClick={() => togglePanel('rank')}
            data-tooltip="Rank System"
          >
            <Trophy size={15} color={activePanel === 'rank' ? rankInfo.currentRank.badgeColor : undefined} />
          </button>
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
              try {
                if (window.electronAPI) {
                  await window.electronAPI.writeImageToClipboard(croppedDataUrl);
                  console.log('[FocusBro] Cropped image written to clipboard via IPC.');
                }
              } catch (err) {
                console.error('[FocusBro] Failed to write cropped image to clipboard:', err);
              }
              setCropImage(null);
              setActivePanel('ai');
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
            <div className={`floating-panel ${activePanel === 'rank' ? 'wide-panel' : ''}`}>
              <div className="panel-header">
                <h3>{panelTitle}</h3>
                <button onClick={() => setActivePanel(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="panel-content">
                {activePanel === 'rank' && (
                  <div className="animate-fade-in" style={{ height: '100%' }}>
                    <RankTab
                      totalStudySeconds={totalStudySeconds}
                      onUpdateStudySeconds={handleUpdateStudySeconds}
                      currentClassification={currentClassification}
                      currentTitle={webviewRef.current?.getTitle() || ''}
                    />
                  </div>
                )}
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
