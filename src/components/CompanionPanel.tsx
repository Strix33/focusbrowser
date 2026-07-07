import React from 'react';
import { BookOpen, Sparkles, Settings } from 'lucide-react';
import NotesTab from './NotesTab';
import AskAiTab from './AskAiTab';
import SettingsTab from './SettingsTab';
import type { ApiKeys } from '../utils/ai-providers';

interface CompanionPanelProps {
  activeTab: 'notes' | 'ai' | 'settings';
  setActiveTab: (tab: 'notes' | 'ai' | 'settings') => void;
  blockedKeywords: string[];
  onUpdateKeywords: (keywords: string[]) => void;
  apiKeys: ApiKeys;
  onSaveApiKeys: (keys: ApiKeys) => void;
  focusAskAiInput: number;
  webviewRef: React.MutableRefObject<any>;
  screenshotTriggerTime: number;
}

export default function CompanionPanel({
  activeTab,
  setActiveTab,
  blockedKeywords,
  onUpdateKeywords,
  apiKeys,
  onSaveApiKeys,
  focusAskAiInput,
  webviewRef,
  screenshotTriggerTime
}: CompanionPanelProps) {
  return (
    <div style={styles.container} className="glass-panel">
      {/* Header Tabs */}
      <div style={styles.header}>
        <button
          onClick={() => setActiveTab('notes')}
          style={{
            ...styles.tabButton,
            backgroundColor: activeTab === 'notes' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'notes' ? '#8b5cf6' : '#9ca3af',
            borderBottom: activeTab === 'notes' ? '2px solid #8b5cf6' : '2px solid transparent',
          }}
        >
          <BookOpen size={16} style={{ marginRight: '6px' }} />
          Notes
        </button>
        
        <button
          onClick={() => setActiveTab('ai')}
          style={{
            ...styles.tabButton,
            backgroundColor: activeTab === 'ai' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'ai' ? '#8b5cf6' : '#9ca3af',
            borderBottom: activeTab === 'ai' ? '2px solid #8b5cf6' : '2px solid transparent',
          }}
        >
          <Sparkles size={16} style={{ marginRight: '6px' }} />
          Ask AI
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{
            ...styles.tabButton,
            backgroundColor: activeTab === 'settings' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'settings' ? '#8b5cf6' : '#9ca3af',
            borderBottom: activeTab === 'settings' ? '2px solid #8b5cf6' : '2px solid transparent',
          }}
        >
          <Settings size={16} style={{ marginRight: '6px' }} />
          Settings
        </button>
      </div>

      {/* Tab Contents */}
      <div style={styles.content}>
        {activeTab === 'notes' && (
          <div className="animate-fade-in" style={{ height: '100%' }}>
            <NotesTab geminiKey={apiKeys.gemini} />
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="animate-fade-in" style={{ height: '100%' }}>
            <AskAiTab
              focusAskAiInput={focusAskAiInput}
              screenshotTriggerTime={screenshotTriggerTime}
            />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ height: '100%' }}>
            <SettingsTab
              blockedKeywords={blockedKeywords}
              onUpdateKeywords={onUpdateKeywords}
              apiKeys={apiKeys}
              onSaveApiKeys={onSaveApiKeys}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '420px',
    minWidth: '380px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#0f111a',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '48px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    backgroundColor: '#0a0b10',
    padding: '0 8px',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    position: 'relative' as const,
  }
};
