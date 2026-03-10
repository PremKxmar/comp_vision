import { DocumentItem, ScanResult } from './types';

const DOCS_KEY = 'scanpro_docs';
const SETTINGS_KEY = 'scanpro_settings';

// ============================================================================
// DOCUMENTS
// ============================================================================

export const loadDocuments = (): DocumentItem[] => {
  try {
    const data = localStorage.getItem(DOCS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const saveDocs = (docs: DocumentItem[]) => {
  try { localStorage.setItem(DOCS_KEY, JSON.stringify(docs)); } catch {}
};

export const addDocument = (doc: DocumentItem) => {
  const docs = loadDocuments();
  docs.unshift(doc);
  saveDocs(docs);
};

export const removeDocument = (id: string) => {
  saveDocs(loadDocuments().filter(d => d.id !== id));
};

export const getDocument = (id: string): DocumentItem | undefined => {
  return loadDocuments().find(d => d.id === id);
};

export const updateDocument = (id: string, updates: Partial<DocumentItem>) => {
  const docs = loadDocuments();
  const idx = docs.findIndex(d => d.id === id);
  if (idx !== -1) {
    docs[idx] = { ...docs[idx], ...updates };
    saveDocs(docs);
  }
};

export const clearAllDocuments = () => {
  localStorage.removeItem(DOCS_KEY);
};

export const getDocumentCount = (): number => loadDocuments().length;

// ============================================================================
// CURRENT SCAN SESSION (in-memory, passed between screens)
// ============================================================================

/**
 * We store the full ScanResult returned by the backend plus the original
 * base64 that the user uploaded (the backend may or may not echo it back).
 */
interface CurrentScanState {
  originalImage: string;
  result: ScanResult;
}

let currentScan: CurrentScanState | null = null;

/** Save after a successful scan */
export const setCurrentScan = (originalImage: string, result: ScanResult) => {
  currentScan = { originalImage, result };
};

/** Retrieve the current scan (used by EditScreen / ResultScreen) */
export const getCurrentScan = (): CurrentScanState | null => currentScan;

export const clearCurrentScan = () => { currentScan = null; };

// ============================================================================
// SETTINGS
// ============================================================================

export interface AppSettings {
  scanQuality: 'low' | 'medium' | 'high';
  autoEnhance: boolean;
  removeShadows: boolean;
  theme: 'dark' | 'light' | 'system';
}

const defaultSettings: AppSettings = {
  scanQuality: 'high',
  autoEnhance: true,
  removeShadows: true,
  theme: 'dark',
};

export const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {}
  return defaultSettings;
};

export const saveSettings = (s: Partial<AppSettings>): AppSettings => {
  const updated = { ...loadSettings(), ...s };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
};

// ============================================================================
// UTILS
// ============================================================================

export const getFileSizeString = (base64: string): string => {
  const stringLength = base64.length - 'data:image/jpeg;base64,'.length;
  const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
  const sizeInKb = sizeInBytes / 1000;
  if (sizeInKb > 1000) return `${(sizeInKb / 1000).toFixed(1)} MB`;
  return `${sizeInKb.toFixed(0)} KB`;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
};
