/**
 * API Service for Document Scanner Backend
 * 
 * Connects the ScanPro React UI to the Flask backend API.
 * 
 * Backend endpoints:
 *   POST /api/scan     - Full document scanning
 *   POST /api/detect   - Detect document corners
 *   POST /api/enhance  - Enhance image
 *   POST /api/export-pdf - Export to PDF
 *   GET  /api/health   - Health check
 *   GET  /api/info     - API capabilities
 */

// Configure the API base URL - Using local backend on same WiFi
// Change this IP to your laptop's local IP address
const API_BASE_URL = 'http://10.12.77.169:5000';

export interface ScanOptions {
  remove_shadows?: boolean;
  enhance?: boolean;
  output_format?: 'jpeg' | 'png';
}

export interface ScanResult {
  success: boolean;
  scan?: string; // base64 encoded image
  corners?: number[][]; // [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
  confidence?: number;
  processing_time_ms?: number;
  message?: string;
  error?: string;
}

export interface DetectResult {
  success: boolean;
  detected: boolean;
  corners?: number[][];
  confidence?: number;
  mask?: string;
  error?: string;
}

export interface EnhanceResult {
  success: boolean;
  enhanced?: string; // base64 encoded image
  error?: string;
}

export interface ExportPdfResult {
  success: boolean;
  pdf?: string; // base64 encoded PDF
  pages?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: string;
  timestamp: number;
  service: string;
}

export interface ApiInfoResult {
  name: string;
  version: string;
  device: string;
  capabilities: string[];
  endpoints: Record<string, string>;
}

/**
 * Convert file/blob to base64 string
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert canvas to base64 string
 */
export function canvasToBase64(canvas: HTMLCanvasElement, format: string = 'image/jpeg'): string {
  return canvas.toDataURL(format, 0.9);
}

/**
 * Convert base64 to blob for download
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  const arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/**
 * Download base64 data as file
 */
export function downloadBase64(base64: string, filename: string): void {
  const blob = base64ToBlob(base64);
  const url = URL.createObjectURL(blob);

  // Detect iOS
  // @ts-ignore
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // On iOS, open in new window to allow "Save to Files" via share sheet
    // We use a timeout to ensure the UI has updated before opening
    setTimeout(() => {
      const win = window.open(url, '_blank');
      if (!win) {
        // If popup blocked, try navigating current window
        window.location.href = url;
      }
    }, 100);

    // Clean up after a delay (iOS needs time to load it)
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    // Standard download for Desktop/Android
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Health check - verify backend is running
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error('Backend not reachable');
  }
  return response.json();
}

/**
 * Get API info and capabilities
 */
export async function getApiInfo(): Promise<ApiInfoResult> {
  const response = await fetch(`${API_BASE_URL}/api/info`);
  if (!response.ok) {
    throw new Error('Failed to get API info');
  }
  return response.json();
}

/**
 * Scan a document image
 * 
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @param options - Scan options
 * @returns Scan result with scanned image and metadata
 */
export async function scanDocument(
  imageBase64: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  // Create abort controller for timeout (2 minute timeout for processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/scan`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        options: {
          remove_shadows: options.remove_shadows ?? true,
          enhance: options.enhance ?? true,
          output_format: options.output_format ?? 'jpeg'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Server error: ${response.status} ${response.statusText}`
      };
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. The server may be starting up - please try again.'
      };
    }
    throw error;
  }
}

/**
 * Detect document corners (quick detection without full scanning)
 * 
 * @param imageBase64 - Base64 encoded image
 * @param includeMask - Whether to include detection mask in response
 * @returns Detection result with corners
 */
export async function detectCorners(
  imageBase64: string,
  includeMask: boolean = false
): Promise<DetectResult> {
  const response = await fetch(`${API_BASE_URL}/api/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,
      include_mask: includeMask
    })
  });

  return response.json();
}

/**
 * Enhance a document image (shadow removal, sharpening)
 * 
 * @param imageBase64 - Base64 encoded image
 * @param options - Enhancement options
 * @returns Enhanced image
 */
export async function enhanceImage(
  imageBase64: string,
  options: { remove_shadows?: boolean; sharpen?: boolean; denoise?: boolean } = {}
): Promise<EnhanceResult> {
  const response = await fetch(`${API_BASE_URL}/api/enhance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,
      options: {
        remove_shadows: options.remove_shadows ?? true,
        sharpen: options.sharpen ?? true,
        denoise: options.denoise ?? true
      }
    })
  });

  return response.json();
}

/**
 * Export images to PDF
 * 
 * @param images - Array of base64 encoded images
 * @param options - Export options
 * @returns PDF as base64
 */
export async function exportToPdf(
  images: string[],
  options: { page_size?: 'A4' | 'letter'; add_ocr?: boolean } = {}
): Promise<ExportPdfResult> {
  console.log('[API] Exporting to PDF, images:', images.length);

  // Create abort controller for timeout (2 minute timeout for processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/export-pdf`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        images,
        options: {
          page_size: options.page_size ?? 'A4',
          add_ocr: options.add_ocr ?? false
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[API] PDF export HTTP error:', response.status);
      return {
        success: false,
        error: `Server error: ${response.status} ${response.statusText}`
      };
    }

    const result = await response.json();
    console.log('[API] PDF export result:', result.success);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[API] PDF export error:', error);
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out'
      };
    }
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// =============================================================================
// Convenience Hooks / State Management
// =============================================================================

/**
 * Scanner state for use in React components
 */
export interface ScannerState {
  isScanning: boolean;
  isDetecting: boolean;
  lastResult: ScanResult | null;
  error: string | null;
}

/**
 * Create initial scanner state
 */
export function createInitialScannerState(): ScannerState {
  return {
    isScanning: false,
    isDetecting: false,
    lastResult: null,
    error: null
  };
}

// Export default API object for convenience
const api = {
  checkHealth,
  getApiInfo,
  scanDocument,
  detectCorners,
  enhanceImage,
  exportToPdf,
  fileToBase64,
  canvasToBase64,
  base64ToBlob,
  downloadBase64
};

export default api;
