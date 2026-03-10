import React, { useState, useEffect } from 'react';
import { DocumentItem } from '../types';
import { getCurrentScan, addDocument, formatDate, getFileSizeString } from '../store';
import { downloadBase64, exportToPdf, base64ToBlob, scanDocument } from '../services/api';

interface ResultScreenProps {
  onAddPage: () => void;
  onRetake: () => void;
  onFinish: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ onAddPage, onRetake, onFinish }) => {
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [detectionMethod, setDetectionMethod] = useState<string>('');
  const [sliderPos, setSliderPos] = useState(50);
  const [docTitle, setDocTitle] = useState('New Document');
  const [isSaved, setIsSaved] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  useEffect(() => {
    const scanState = getCurrentScan();
    if (scanState) {
      setScanImage(scanState.result.scan || null);
      setOriginalImage(scanState.originalImage);
      setConfidence(scanState.result.confidence ?? 0);
      setProcessingTime(scanState.result.processing_time_ms ?? null);
      setDetectionMethod(scanState.result.method ?? '');
      setDocTitle(`Scan ${formatDate(new Date())}`);
    }
  }, []);

  if (!scanImage) return null;

  const handleSave = () => {
    if (isSaved) return;
    const newDoc: DocumentItem = {
      id: Date.now().toString(),
      title: docTitle,
      date: formatDate(new Date()),
      size: getFileSizeString(scanImage),
      thumbnail: scanImage,
      type: 'jpg',
      originalImage: originalImage || undefined,
      enhancedImage: scanImage,
      pageCount: pageCount
    };
    addDocument(newDoc);
    setIsSaved(true);
  };

  const handleDownload = () => {
    downloadBase64(scanImage, `${docTitle}.jpg`);
  };

  const handleExportPdf = async () => {
    const result = await exportToPdf([scanImage]);
    if (result.success && result.pdf) {
      // Download the real PDF from the backend
      const blob = base64ToBlob(result.pdf);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert('PDF export failed: ' + (result.error || 'Unknown error'));
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: docTitle,
          text: 'Scanned with ScanPro',
          url: window.location.href // In real app, would share file
        });
      } catch (e) { console.log(e); }
    } else {
      handleDownload();
    }
  };

  const handleDone = () => {
    if (!isSaved) handleSave();
    onFinish();
  };

  const handleToggleEnhance = async () => {
    if (!originalImage || isReprocessing) return;
    setIsReprocessing(true);
    const newEnhanced = !isEnhanced;
    try {
      const result = await scanDocument(originalImage, {
        remove_shadows: true,
        enhance: newEnhanced,
        output_format: 'jpeg',
      });
      if (result.success && result.scan) {
        setScanImage(result.scan);
        setIsEnhanced(newEnhanced);
        setConfidence(result.confidence ?? confidence);
        setProcessingTime(result.processing_time_ms ?? processingTime);
        setDetectionMethod(result.method ?? detectionMethod);
      }
    } catch (e) {
      console.error('Re-process failed:', e);
    }
    setIsReprocessing(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-fade-up">
      
      {/* Left: Comparison Slider */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="rounded-lg border border-white/[0.06] overflow-hidden relative aspect-[3/4] max-h-[75vh] bg-zinc-950 select-none group">
          
          {/* Enhanced (Background) */}
          <div 
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${scanImage})` }}
          />

          {/* Original (Foreground, Clipped) */}
          <div 
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <div 
              className="absolute inset-0 bg-contain bg-center bg-no-repeat w-full h-full brightness-90 contrast-[0.85]"
              style={{ backgroundImage: `url(${originalImage})` }}
            />
            {/* Divider Line */}
            <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-white/30" />
          </div>

          {/* Handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center pointer-events-none"
            style={{ left: `${sliderPos}%`, transform: `translate(-50%, -50%)` }}
          >
            <div className="size-7 bg-white rounded-full shadow-md flex items-center justify-center">
              <span className="material-symbols-outlined text-zinc-700 text-[14px]">code</span>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/50 text-zinc-300 text-[10px] font-bold uppercase tracking-wider border border-white/[0.06]">
            Original
          </div>
          <div className="absolute top-3 right-3 px-2 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider border border-white/[0.06] shadow-lg">
            Enhanced
          </div>

          {/* Interactive Range Input */}
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={sliderPos} 
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
          />
        </div>
        <p className="text-center text-xs text-zinc-500 mt-2 lg:hidden">Drag slider to compare</p>
      </div>

      {/* Right: Details & Actions */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Title Input */}
        <input 
          value={docTitle} 
          onChange={(e) => setDocTitle(e.target.value)}
          className="bg-transparent text-white text-lg font-semibold border-none outline-none w-full focus:bg-white/[0.04] rounded px-1 -mx-1 mb-2 transition-colors"
        />

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-4">
          <Stat icon="verified" text={`Confidence: ${confidence}%`} />
          <Stat icon="timer" text={`Processing: ${processingTime ?? '—'}ms`} />
          <Stat icon="description" text={`Pages: ${pageCount}`} />
          {detectionMethod && <Stat icon="psychology" text={`Method: ${detectionMethod === 'dl' ? 'Deep Learning' : detectionMethod === 'classical' ? 'Classical CV' : detectionMethod}`} />}
        </div>

        {/* Badges */}
        <div className="mb-6 flex flex-wrap gap-2">
           <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border border-emerald-500/10">
              <span className="material-symbols-outlined text-[14px]">wb_sunny</span>
              Shadow Removed
           </span>
           {detectionMethod === 'dl' && (
             <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border border-indigo-500/10">
                <span className="material-symbols-outlined text-[14px]">neurology</span>
                AI Detection
             </span>
           )}
           {detectionMethod === 'classical' && (
             <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border border-cyan-500/10">
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                Classical CV
             </span>
           )}
        </div>

        {/* Enhance Toggle */}
        <div className="mb-4">
          <button
            onClick={handleToggleEnhance}
            disabled={isReprocessing}
            className={`w-full h-10 px-4 rounded-lg border flex items-center justify-between text-sm transition-all
              ${isEnhanced
                ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'}
              ${isReprocessing ? 'opacity-60 cursor-wait' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[18px] ${isEnhanced ? 'text-amber-400' : 'text-zinc-400'}`}>
                auto_fix_high
              </span>
              <span className={isEnhanced ? 'text-amber-300' : 'text-zinc-300'}>
                {isReprocessing ? 'Reprocessing…' : 'Enhance Colors'}
              </span>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors relative ${isEnhanced ? 'bg-amber-500' : 'bg-zinc-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isEnhanced ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
          <p className="text-[10px] text-zinc-600 mt-1 ml-1">
            {isEnhanced ? 'Enhanced: brighter paper, balanced contrast' : 'Off: original scanned colors, no processing'}
          </p>
        </div>

        <div className="border-t border-white/[0.06] my-4" />

        {/* Actions Stack */}
        <div className="flex flex-col gap-3">
          <ActionButton 
            icon={isSaved ? "check" : "save"} 
            label={isSaved ? "Saved" : "Save to Library"} 
            onClick={handleSave}
            active={isSaved}
            color={isSaved ? 'text-emerald-400' : 'text-zinc-300'}
          />
          <ActionButton icon="picture_as_pdf" label="Export as PDF" onClick={handleExportPdf} />
          <ActionButton icon="share" label="Share" onClick={handleShare} />
          <ActionButton icon="download" label="Download Image" onClick={handleDownload} />
        </div>

        <div className="border-t border-white/[0.06] my-4" />

        <div className="flex gap-3 mb-3">
          <button 
            onClick={onRetake}
            className="flex-1 border border-white/[0.06] h-9 rounded-lg text-sm text-zinc-400 hover:bg-white/[0.04] transition-colors"
          >
            Retake
          </button>
          <button 
            onClick={() => { setPageCount(p => p + 1); onAddPage(); }}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 h-9 rounded-lg text-sm text-white font-medium transition-colors"
          >
            Add Page
          </button>
        </div>

        <button 
          onClick={handleDone}
          className="w-full bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.08] h-10 rounded-lg text-sm text-white font-medium transition-colors"
        >
          Done
        </button>

      </div>
    </div>
  );
};

const Stat = ({ icon, text }: { icon: string, text: string }) => (
  <div className="flex items-center gap-1 text-xs text-zinc-500">
    <span className="material-symbols-outlined text-[14px]">{icon}</span>
    <span>{text}</span>
  </div>
);

const ActionButton = ({ icon, label, onClick, active, color }: any) => (
  <button 
    onClick={onClick}
    className={`w-full h-9 px-4 rounded-lg border flex items-center gap-3 text-sm transition-all
      ${active ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'}
    `}
  >
    <span className={`material-symbols-outlined text-[18px] ${color || 'text-zinc-400'}`}>{icon}</span>
    <span className={color || 'text-zinc-300'}>{label}</span>
  </button>
);

export default ResultScreen;
