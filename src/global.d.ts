interface ApiKeys {
  gemini: string;
  openai: string;
  anthropic: string;
}

interface ElectronAPI {
  getNotes: () => Promise<any[]>;
  saveNotes: (notes: any[]) => Promise<boolean>;
  saveNoteImage: (fileBuffer: ArrayBuffer, fileName: string) => Promise<string | null>;
  getConfig: () => Promise<{ blockedKeywords: string[]; defaultAiProvider?: string; totalStudySeconds?: number }>;
  saveConfig: (config: { blockedKeywords?: string[]; defaultAiProvider?: string; totalStudySeconds?: number }) => Promise<boolean>;
  getRankVideoUrl: (fileName: string) => Promise<string | null>;
  onGlobalAskAi: (callback: () => void) => () => void;
  writeImageToClipboard: (dataUrl: string) => Promise<boolean>;
  writeTextToClipboard: (text: string) => Promise<boolean>;
  readClipboardText: () => string;
  hasClipboardImage: () => boolean;
  webviewPreloadPath: string;
}

interface Window {
  electronAPI: ElectronAPI;
}

// Electron Forge + Vite injected global constants
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

declare module 'electron-squirrel-startup';
declare module '@ghostery/adblocker-electron';
