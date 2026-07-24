import { contextBridge, ipcRenderer, clipboard } from 'electron';
import path from 'node:path';

// Expose APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes: any) => ipcRenderer.invoke('save-notes', notes),
  saveNoteImage: (fileBuffer: ArrayBuffer, fileName: string) => ipcRenderer.invoke('save-note-image', fileBuffer, fileName),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  getRankVideoUrl: (fileName: string) => ipcRenderer.invoke('get-rank-video-url', fileName),
  onGlobalAskAi: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('global-ask-ai', listener);
    return () => ipcRenderer.removeListener('global-ask-ai', listener);
  },
  // Write a cropped image (dataURL) to the system clipboard via main process
  writeImageToClipboard: (dataUrl: string) => ipcRenderer.invoke('write-image-to-clipboard', dataUrl),
  // Write text to the system clipboard via main process
  writeTextToClipboard: (text: string) => ipcRenderer.invoke('write-text-to-clipboard', text),
  // Read text from the system clipboard
  readClipboardText: () => clipboard.readText(),
  // Check if clipboard has an image
  hasClipboardImage: () => !clipboard.readImage().isEmpty(),
  // Expose the bundled path to the webview preload script
  webviewPreloadPath: path.join(__dirname, 'webview-preload.js')
});
