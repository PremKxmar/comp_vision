export interface DocumentItem {
  id: string;
  title: string;
  date: string;
  size: string;
  thumbnail: string;
  pageCount?: number;
  type: 'pdf' | 'jpg';
  originalImage?: string; // Stored base64 of original if needed
  enhancedImage?: string; // Stored base64 of enhanced
}

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'library'
  | 'tools'
  | 'camera'
  | 'edit'
  | 'result'
  | 'viewer'
  | 'settings';

/** Matches the Flask backend /api/scan JSON response */
export interface ScanResult {
  success: boolean;
  scan?: string;               // Base64 of scanned image
  corners?: number[][];        // 4 points
  confidence?: number;         // 0-100
  original?: string;           // Base64 of original (pass-through or echoed)
  processing_time_ms?: number;
  method?: 'dl' | 'classical' | 'hybrid' | 'none' | string;  // Detection method used
  message?: string;
  error?: string;
}

export interface ScannerState {
  isProcessing: boolean;
  error: string | null;
  previewImage: string | null;
}

export interface ScanOptions {
  remove_shadows?: boolean;
  enhance?: boolean;
  output_format?: 'jpeg' | 'png';
}

export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}
