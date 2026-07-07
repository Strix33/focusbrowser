import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Globe, Search } from 'lucide-react';

interface BrowserViewProps {
  webviewRef: React.MutableRefObject<any>;
  blockedKeywords: string[];
}

export default function BrowserView({ webviewRef, blockedKeywords }: BrowserViewProps) {
  const [urlInput, setUrlInput] = useState('https://www.youtube.com');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const initWebviewEvents = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => {
      setIsLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleNavigate = (e: any) => {
      setUrlInput(e.url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  };

  useEffect(() => {
    const cleanup = initWebviewEvents();
    return () => {
      if (cleanup) cleanup();
    };
  }, [webviewRef.current]);

  const handleNavigateToUrl = (targetUrl: string) => {
    let formattedUrl = targetUrl.trim();
    if (!formattedUrl) return;

    // Check if it's a valid URL or a search query
    const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(formattedUrl);
    if (!isUrl) {
      formattedUrl = `https://www.google.com/search?q=${encodeURIComponent(formattedUrl)}`;
    } else if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    if (webviewRef.current) {
      webviewRef.current.src = formattedUrl;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNavigateToUrl(urlInput);
    }
  };

  const goBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const goForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const reload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Navigation Controls Bar */}
      <div style={styles.navBar}>
        <div style={styles.navButtons}>
          <button 
            onClick={goBack} 
            disabled={!canGoBack} 
            style={{ ...styles.iconButton, opacity: canGoBack ? 1 : 0.3 }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <button 
            onClick={goForward} 
            disabled={!canGoForward} 
            style={{ ...styles.iconButton, opacity: canGoForward ? 1 : 0.3 }}
            title="Forward"
          >
            <ArrowRight size={18} />
          </button>
          <button 
            onClick={reload} 
            style={styles.iconButton}
            title="Reload"
          >
            <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Address Input */}
        <div style={styles.addressContainer}>
          <div style={styles.addressIcon}>
            {urlInput.startsWith('https://') ? (
              <Globe size={14} color="#10b981" />
            ) : (
              <Search size={14} color="#9ca3af" />
            )}
          </div>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={styles.addressInput}
            placeholder="Search or enter web address..."
          />
          {isLoading && <div style={styles.loadingPulse} />}
        </div>
      </div>

      {/* Browser Webview Viewport */}
      {/* @ts-ignore */}
      <webview
        ref={webviewRef}
        src="https://www.youtube.com"
        preload={window.electronAPI.webviewPreloadPath}
        style={{ flex: 1, backgroundColor: '#000' }}
      />
    </div>
  );
}

const styles = {
  navBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#0f111a',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    gap: '12px',
  },
  navButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#f3f4f6',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    outline: 'none',
  },
  addressContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#1b1d28',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px',
    padding: '6px 12px',
    position: 'relative' as const,
    gap: '8px',
  },
  addressIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  addressInput: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#f3f4f6',
    outline: 'none',
    fontSize: '13px',
    width: '100%',
  },
  loadingPulse: {
    position: 'absolute' as const,
    bottom: 0,
    left: '10%',
    width: '80%',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)',
    animation: 'pulse 1.5s infinite',
  }
};
