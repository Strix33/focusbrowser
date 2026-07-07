import React, { useState } from 'react';
import { Key, Eye, EyeOff, Save, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { ApiKeys } from '../utils/ai-providers';

interface SettingsTabProps {
  blockedKeywords: string[];
  onUpdateKeywords: (keywords: string[]) => void;
  apiKeys: ApiKeys;
  onSaveApiKeys: (keys: ApiKeys) => void;
  defaultAiProvider?: string;
  onUpdateDefaultAiProvider?: (provider: string) => void;
}

interface ApiKeyConfig {
  id: keyof ApiKeys;
  label: string;
  color: string;
  link: string;
  linkText: string;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    color: '#4285f4',
    link: 'https://aistudio.google.com/',
    linkText: 'Google AI Studio',
  },
  {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    color: '#10a37f',
    link: 'https://platform.openai.com/api-keys',
    linkText: 'OpenAI Platform',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    color: '#e87f5f',
    link: 'https://console.anthropic.com/settings/keys',
    linkText: 'Anthropic Console',
  },
];

export default function SettingsTab({
  blockedKeywords,
  onUpdateKeywords,
  apiKeys,
  onSaveApiKeys,
  defaultAiProvider = '',
  onUpdateDefaultAiProvider
}: SettingsTabProps) {
  const [keyInputs, setKeyInputs] = useState<ApiKeys>({ ...apiKeys });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    gemini: true,
    openai: false,
    anthropic: false,
  });
  const [newKeyword, setNewKeyword] = useState('');

  const handleSaveKey = (keyId: keyof ApiKeys) => {
    onSaveApiKeys({ ...apiKeys, [keyId]: keyInputs[keyId] });
    setSaveSuccess(prev => ({ ...prev, [keyId]: true }));
    setTimeout(() => setSaveSuccess(prev => ({ ...prev, [keyId]: false })), 2000);
  };

  const toggleExpanded = (keyId: string) => {
    setExpandedKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleAddKeyword = () => {
    const word = newKeyword.trim();
    if (word && !blockedKeywords.includes(word)) {
      onUpdateKeywords([...blockedKeywords, word]);
      setNewKeyword('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddKeyword();
    }
  };

  const handleRemoveKeyword = (wordToRemove: string) => {
    onUpdateKeywords(blockedKeywords.filter(w => w !== wordToRemove));
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Settings</h2>

      {/* AI API Keys Section */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>
          <Key size={16} style={{ marginRight: '6px' }} />
          AI Provider Keys
        </h3>
        <p style={styles.description}>
          Configure API keys for the AI providers you want to use. You only need keys for the providers you plan to use.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
          {API_KEY_CONFIGS.map(config => {
            const isExpanded = expandedKeys[config.id];
            const hasKey = !!keyInputs[config.id];

            return (
              <div key={config.id} style={styles.keySection}>
                {/* Header / Accordion Toggle */}
                <button
                  onClick={() => toggleExpanded(config.id)}
                  style={{
                    ...styles.keySectionHeader,
                    borderColor: isExpanded ? config.color + '40' : 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isExpanded
                      ? <ChevronDown size={14} color={config.color} />
                      : <ChevronRight size={14} color="#6b7280" />
                    }
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: hasKey ? config.color : '#374151',
                        boxShadow: hasKey ? `0 0 6px ${config.color}60` : 'none',
                        transition: 'all 0.2s',
                      }}
                    />
                    <span style={{ color: isExpanded ? config.color : '#d1d5db', fontWeight: 500, fontSize: '13px' }}>
                      {config.label}
                    </span>
                  </div>
                  {hasKey && !isExpanded && (
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Configured ✓</span>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={styles.keySectionBody}>
                    <p style={{ ...styles.description, margin: 0 }}>
                      Get your key at{' '}
                      <a href={config.link} target="_blank" rel="noreferrer" style={{ ...styles.link, color: config.color }}>
                        {config.linkText}
                      </a>
                    </p>
                    <div style={styles.inputRow}>
                      <div style={styles.inputWrapper}>
                        <input
                          type={showKeys[config.id] ? 'text' : 'password'}
                          value={keyInputs[config.id]}
                          onChange={(e) => setKeyInputs(prev => ({ ...prev, [config.id]: e.target.value }))}
                          placeholder={`Enter ${config.label} API Key...`}
                          style={styles.input}
                        />
                        <button
                          onClick={() => setShowKeys(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                          style={styles.eyeButton}
                        >
                          {showKeys[config.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSaveKey(config.id)}
                        style={{
                          ...styles.primaryButton,
                          backgroundColor: config.color,
                        }}
                      >
                        {saveSuccess[config.id] ? 'Saved!' : <Save size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Shortcut Behavior */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>
          <Sparkles size={16} style={{ marginRight: '6px' }} />
          Shortcut Behavior
        </h3>
        <p style={styles.description}>
          Choose which AI provider should be used automatically when you trigger the <strong>Ctrl+Shift+Space</strong> shortcut.
        </p>
        <div style={styles.inputRow}>
          <select
            value={defaultAiProvider}
            onChange={(e) => onUpdateDefaultAiProvider && onUpdateDefaultAiProvider(e.target.value)}
            style={{ ...styles.input, cursor: 'pointer' }}
          >
            <option value="">No Default (Use last active)</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
            <option value="claude">Claude</option>
            <option value="duckduckgo">DuckDuckGo Chat</option>
          </select>
        </div>
      </div>

      {/* YouTube Feed Enhancer Section */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>
          <RefreshCw size={16} style={{ marginRight: '6px' }} />
          YouTube Feed Enhancer
        </h3>
        <p style={styles.description}>
          Block videos containing specific keywords from appearing on your YouTube feed. Hiding takes effect immediately, and removing keywords restores them.
        </p>

        {/* Add keyword input */}
        <div style={styles.inputRow}>
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Add block keyword (e.g. gaming, cats)..."
            style={styles.input}
          />
          <button onClick={handleAddKeyword} style={styles.primaryButton}>
            <Plus size={16} />
          </button>
        </div>

        {/* Blocked keywords list */}
        <div style={styles.keywordList}>
          {blockedKeywords.length === 0 ? (
            <p style={styles.emptyText}>No keywords blocked. Feed is unaltered.</p>
          ) : (
            blockedKeywords.map((word) => (
              <div key={word} style={styles.keywordTag}>
                <span style={styles.keywordText}>{word}</span>
                <button
                  onClick={() => handleRemoveKeyword(word)}
                  style={styles.deleteButton}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    overflowY: 'auto' as const,
    height: '100%',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f3f4f6',
    marginBottom: '8px',
  },
  card: {
    backgroundColor: '#1b1d28',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
  },
  description: {
    fontSize: '12px',
    color: '#9ca3af',
    lineHeight: '1.5',
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 500,
  },
  keySection: {
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  keySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    backgroundColor: '#0f111a',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#d1d5db',
    transition: 'all 0.2s',
    width: '100%',
  } as React.CSSProperties,
  keySectionBody: {
    padding: '10px 12px',
    backgroundColor: '#0a0b10',
    borderRadius: '0 0 8px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    width: '100%',
    marginTop: '6px',
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#0c0d12',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '0 8px',
  },
  input: {
    flex: 1,
    height: '38px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#f3f4f6',
    outline: 'none',
    fontSize: '13px',
    padding: '0 4px',
    minWidth: '50px',
  },
  eyeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '38px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  keywordList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginTop: '10px',
    minHeight: '40px',
    alignItems: 'center',
  },
  keywordTag: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '4px 10px',
    gap: '6px',
  },
  keywordText: {
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: 500,
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  }
};
