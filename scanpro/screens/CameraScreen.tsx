import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ScannerState } from '../types';
import { fileToBase64, scanDocument, checkHealth } from '../services/api';
import { setCurrentScan, loadSettings } from '../store';

interface CameraScreenProps {
  onCapture: () => void;
  onCancel: () => void;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onCapture, onCancel }) => {
  const [state, setState] = useState<ScannerState>({
    isProcessing: false,
    error: null,
    previewImage: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);

  // Scan options
  const settings = loadSettings();
  const [removeShadows, setRemoveShadows] = useState(settings.removeShadows ?? true);
  const [autoEnhance, setAutoEnhance] = useState(settings.autoEnhance ?? false);
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png'>('jpeg');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Check backend status on mount
  useEffect(() => {
    checkHealth().then(setApiOnline);
  }, []);

  // Animate processing steps
  useEffect(() => {
    if (!state.isProcessing) { setProcessingStep(0); return; }
    const steps = [0, 1, 2, 3];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < steps.length) setProcessingStep(steps[i]);
      else clearInterval(interval);
    }, 1800);
    return () => clearInterval(interval);
  }, [state.isProcessing]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setFileSize(formatSize(file.size));
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      const base64 = await fileToBase64(file);
      setState(prev => ({ ...prev, previewImage: base64 }));

      const result = await scanDocument(base64, {
        remove_shadows: removeShadows,
        enhance: autoEnhance,
        output_format: outputFormat,
      });

      if (!result.success) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: result.error || 'Scan failed. Please try again.',
        }));
        return;
      }

      setCurrentScan(base64, result);
      onCapture();
    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to process document. Check your backend connection.',
      }));
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // ---- Drag & Drop ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processFile(file);
    }
  }, [removeShadows, autoEnhance, outputFormat]);

  const resetState = () => {
    setState({ isProcessing: false, error: null, previewImage: null });
    setFileName(null);
    setFileSize(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const steps = [
    { icon: 'upload_file', label: 'Uploading image', desc: 'Reading and encoding file' },
    { icon: 'center_focus_strong', label: 'Detecting edges', desc: 'Finding document boundaries' },
    { icon: 'wb_sunny', label: 'Removing shadows', desc: 'AI shadow removal in progress' },
    { icon: 'auto_fix_high', label: 'Enhancing output', desc: 'Sharpening & contrast correction' },
  ];

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-up pb-20 lg:pb-0">
      {/* Hidden Inputs */}
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFile} />
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFile} />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: 24 }}>document_scanner</span>
            Document Scanner
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Upload or capture a document to scan, enhance, and export</p>
        </div>
        {/* API Status Pill */}
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border 
          ${apiOnline === true ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
            apiOnline === false ? 'border-red-500/20 bg-red-500/5 text-red-400' :
            'border-zinc-700 bg-white/[0.02] text-zinc-500'}`}
        >
          <div className={`size-1.5 rounded-full ${apiOnline === true ? 'bg-emerald-400' : apiOnline === false ? 'bg-red-400' : 'bg-zinc-500'}`} />
          {apiOnline === true ? 'Backend Connected' : apiOnline === false ? 'Backend Offline' : 'Checking...'}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-0">

        {/* ============ LEFT: DROP ZONE (2 cols) ============ */}
        <div className="lg:col-span-2 relative min-h-[380px]">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`absolute inset-0 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-8 text-center overflow-hidden
              ${isDragging
                ? 'border-indigo-500 bg-indigo-500/[0.06] scale-[1.005]'
                : state.previewImage
                  ? 'border-transparent bg-zinc-900/50'
                  : 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.025]'}
            `}
          >
            {/* Preview State */}
            {state.previewImage ? (
              <>
                <img src={state.previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                {!state.isProcessing && (
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={resetState}
                      className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      Remove
                    </button>
                  </div>
                )}
                {fileName && !state.isProcessing && (
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                    <p className="text-xs text-white font-medium truncate max-w-[200px]">{fileName}</p>
                    <p className="text-[10px] text-zinc-400">{fileSize}</p>
                  </div>
                )}
              </>
            ) : isDragging ? (
              /* Drag Active State */
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: 32 }}>file_download</span>
                </div>
                <p className="text-sm font-medium text-indigo-300">Release to upload</p>
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center gap-5">
                {/* Animated icon cluster */}
                <div className="relative">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/[0.04] flex items-center justify-center">
                    <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 36 }}>cloud_upload</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>add</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-medium text-zinc-300">Drag & drop your document here</p>
                  <p className="text-xs text-zinc-600">or use the buttons below</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/[0.06] border border-white/[0.08] text-sm text-zinc-300 h-10 px-5 rounded-lg hover:bg-white/[0.1] hover:border-white/[0.12] transition-all flex items-center gap-2 active:scale-[0.97]"
                  >
                    <span className="material-symbols-outlined text-zinc-400" style={{ fontSize: 18 }}>folder_open</span>
                    Browse Files
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-sm text-white h-10 px-5 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                    Capture Photo
                  </button>
                </div>

                {/* Supported formats */}
                <div className="flex items-center gap-3 mt-2">
                  {['JPG', 'PNG', 'WEBP'].map(fmt => (
                    <span key={fmt} className="text-[10px] text-zinc-600 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded font-medium">
                      {fmt}
                    </span>
                  ))}
                  <span className="text-[10px] text-zinc-700">•</span>
                  <span className="text-[10px] text-zinc-600">Max 20 MB</span>
                </div>
              </div>
            )}

            {/* Processing Overlay */}
            {state.isProcessing && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-10 flex flex-col items-center justify-center gap-6">
                {/* Animated ring */}
                <div className="relative">
                  <div className="size-16 rounded-full border-[3px] border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: 24 }}>document_scanner</span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Processing Document</p>
                  <p className="text-xs text-zinc-500">{fileName || 'Analyzing image...'}</p>
                </div>

                {/* Step progress */}
                <div className="w-64 flex flex-col gap-3 mt-2">
                  {steps.map((s, i) => {
                    const isDone = processingStep > i;
                    const isActive = processingStep === i;
                    return (
                      <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${isDone ? 'opacity-40' : isActive ? 'opacity-100' : 'opacity-20'}`}>
                        <div className={`size-7 rounded-lg flex items-center justify-center border transition-all
                          ${isDone ? 'bg-emerald-600 border-emerald-600' : isActive ? 'bg-indigo-500/20 border-indigo-500' : 'border-zinc-700 bg-transparent'}`}
                        >
                          {isDone ? (
                            <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>
                          ) : (
                            <span className={`material-symbols-outlined ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`} style={{ fontSize: 14 }}>{s.icon}</span>
                          )}
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isActive ? 'text-white' : 'text-zinc-400'}`}>{s.label}</p>
                          {isActive && <p className="text-[10px] text-zinc-500">{s.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="w-64 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-[1800ms] ease-linear"
                    style={{ width: `${((processingStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============ RIGHT: SIDEBAR PANEL ============ */}
        <div className="flex flex-col gap-4">

          {/* Scan Options Card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: 18 }}>tune</span>
              <h3 className="text-sm font-medium text-white">Scan Options</h3>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <OptionToggle
                icon="wb_sunny"
                label="Shadow Removal"
                desc="Remove lighting artifacts"
                value={removeShadows}
                onChange={setRemoveShadows}
              />
              <OptionToggle
                icon="auto_fix_high"
                label="Auto Enhance"
                desc="Sharpen & improve contrast"
                value={autoEnhance}
                onChange={setAutoEnhance}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">Output Format</label>
                <div className="flex gap-2">
                  {(['jpeg', 'png'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`flex-1 h-8 rounded-md text-xs font-medium border transition-all uppercase
                        ${outputFormat === fmt
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-400 hover:border-white/[0.1]'}`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Error Card */}
          {state.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 animate-fade-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-red-400" style={{ fontSize: 18 }}>error</span>
                <h3 className="text-sm font-medium text-red-300">Scan Failed</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">{state.error}</p>
              <button
                onClick={resetState}
                className="text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                Try Again
              </button>
            </div>
          )}

          {/* How It Works Card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 18 }}>info</span>
              <h3 className="text-sm font-medium text-white">How It Works</h3>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <WorkflowStep
                step={1}
                icon="upload_file"
                title="Upload Document"
                desc="Drag & drop or browse for your document photo"
              />
              <WorkflowStep
                step={2}
                icon="center_focus_strong"
                title="Edge Detection"
                desc="AI detects boundaries and corrects perspective"
              />
              <WorkflowStep
                step={3}
                icon="wb_sunny"
                title="Shadow Removal"
                desc="Advanced algorithm removes lighting artifacts"
              />
              <WorkflowStep
                step={4}
                icon="download"
                title="Export Result"
                desc="Download as image or export to PDF"
              />
            </div>
          </div>

          {/* Capabilities Card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-3">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: 'crop_free', label: 'Auto-crop' },
                { icon: 'straighten', label: 'Perspective fix' },
                { icon: 'contrast', label: 'Contrast boost' },
                { icon: 'wb_sunny', label: 'Shadow removal' },
                { icon: 'picture_as_pdf', label: 'PDF export' },
                { icon: 'high_quality', label: 'HD output' },
              ].map(cap => (
                <span
                  key={cap.label}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-white/[0.03] border border-white/[0.04] px-2.5 py-1 rounded-md"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{cap.icon}</span>
                  {cap.label}
                </span>
              ))}
            </div>
          </div>

          {/* Back / Cancel */}
          <button
            onClick={onCancel}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mt-auto flex items-center gap-1.5 self-start"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back to Library
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Sub-components ----

const OptionToggle = ({ icon, label, desc, value, onChange }: {
  icon: string; label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2.5">
      <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] text-zinc-600">{desc}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-zinc-700'}`}
    >
      <div className={`absolute top-1 size-3 bg-white rounded-full transition-transform ${value ? 'left-5' : 'left-1'}`} />
    </button>
  </div>
);

const WorkflowStep = ({ step, icon, title, desc }: {
  step: number; icon: string; title: string; desc: string;
}) => (
  <div className="flex items-start gap-3 relative">
    {/* Connector line */}
    {step < 4 && <div className="absolute top-7 left-[13px] w-[1px] h-[calc(100%+4px)] bg-white/[0.04]" />}
    <div className="size-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 z-10">
      <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 14 }}>{icon}</span>
    </div>
    <div className="flex flex-col gap-0.5 pt-0.5">
      <p className="text-xs font-medium text-zinc-300">{title}</p>
      <p className="text-[11px] text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default CameraScreen;
