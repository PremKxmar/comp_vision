/**
 * API Service for ScanPro — connects the new UI to the Flask backend.
 *
 * Backend endpoints:
 *   POST /api/scan       – Full document scanning
 *   POST /api/detect     – Detect document corners
 *   POST /api/enhance    – Enhance image
 *   POST /api/export-pdf – Export to PDF
 *   GET  /api/health     – Health check
 *   GET  /api/info       – API capabilities
 */

import { ScanOptions, ScanResult } from '../types';

const API_BASE_URL = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Health / Info
// ---------------------------------------------------------------------------

export const checkHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
};

export const getApiInfo = async () => {
  const res = await fetch(`${API_BASE_URL}/api/info`);
  if (!res.ok) throw new Error('Failed to get API info');
  return res.json();
};

// ---------------------------------------------------------------------------
// Core scanning
// ---------------------------------------------------------------------------

export const scanDocument = async (
  imageBase64: string,
  options: ScanOptions = {}
): Promise<ScanResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

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
          output_format: options.output_format ?? 'jpeg',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Server error: ${response.status} ${response.statusText}`,
      } as ScanResult;
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. The server may be starting up – please try again.',
      } as ScanResult;
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Detect corners only (quick)
// ---------------------------------------------------------------------------

export const detectCorners = async (
  imageBase64: string,
  includeMask = false
) => {
  const res = await fetch(`${API_BASE_URL}/api/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, include_mask: includeMask }),
  });
  return res.json();
};

// ---------------------------------------------------------------------------
// Enhance image
// ---------------------------------------------------------------------------

export const enhanceImage = async (
  imageBase64: string,
  options: { remove_shadows?: boolean; sharpen?: boolean; denoise?: boolean } = {}
) => {
  const res = await fetch(`${API_BASE_URL}/api/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      options: {
        remove_shadows: options.remove_shadows ?? true,
        sharpen: options.sharpen ?? true,
        denoise: options.denoise ?? true,
      },
    }),
  });
  return res.json();
};

// ---------------------------------------------------------------------------
// Export to PDF (real backend call)
// ---------------------------------------------------------------------------

export interface ExportPdfResult {
  success: boolean;
  pdf?: string;   // base64-encoded PDF
  pages?: number;
  error?: string;
}

export const exportToPdf = async (
  images: string[],
  options: { page_size?: 'A4' | 'letter'; add_ocr?: boolean } = {}
): Promise<ExportPdfResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

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
          add_ocr: options.add_ocr ?? false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `Server error: ${response.status}` };
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { success: false, error: err.message || 'Unknown error' };
  }
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Convert a File to a base64 data-URL string */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/** Convert base64 to Blob */
export const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  const arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

/** Download a base64 string as a file */
export const downloadBase64 = (base64: string, filename: string) => {
  const blob = base64ToBlob(base64);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
