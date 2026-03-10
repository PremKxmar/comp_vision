import React, { useState } from 'react';
import { getCurrentScan } from '../store';

interface EditScreenProps {
  onDone: () => void;
  onBack: () => void;
}

const EditScreen: React.FC<EditScreenProps> = ({ onDone, onBack }) => {
  const [filter, setFilter] = useState('Auto');
  const scanState = getCurrentScan();
  
  // Use the original uploaded image for editing preview
  const imageSrc = scanState?.originalImage || scanState?.result?.scan;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] animate-fade-up fixed inset-0 z-50">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-white/[0.06] px-4 flex items-center justify-between flex-shrink-0 bg-[#111118]">
        <button onClick={onBack} className="size-8 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-zinc-400">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="text-sm font-medium text-white">Edit Document</span>
        <button onClick={onDone} className="bg-indigo-600 h-8 px-4 rounded-lg text-sm text-white font-medium hover:bg-indigo-500 transition-colors">
          Apply
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative bg-[#0a0a0f] p-4 flex items-center justify-center overflow-hidden">
        {imageSrc && (
          <div className="relative max-h-[70vh] w-auto inline-block">
             <img 
               src={imageSrc} 
               alt="Editing" 
               className={`max-h-[70vh] w-auto rounded-lg border border-white/[0.06] object-contain 
                 ${filter === 'B&W' ? 'grayscale contrast-125' : 
                   filter === 'Warm' ? 'sepia-[0.3]' : 
                   filter === 'Cool' ? 'hue-rotate-15' : ''}
               `}
             />
             
             {/* Crop Overlay Visualization */}
             <div className="absolute inset-0 border border-indigo-500/50 pointer-events-none">
                {/* Corners */}
                <div className="absolute top-0 left-0 size-3 bg-white rounded-full border-2 border-indigo-500 -translate-x-1.5 -translate-y-1.5" />
                <div className="absolute top-0 right-0 size-3 bg-white rounded-full border-2 border-indigo-500 translate-x-1.5 -translate-y-1.5" />
                <div className="absolute bottom-0 right-0 size-3 bg-white rounded-full border-2 border-indigo-500 translate-x-1.5 translate-y-1.5" />
                <div className="absolute bottom-0 left-0 size-3 bg-white rounded-full border-2 border-indigo-500 -translate-x-1.5 translate-y-1.5" />
                
                {/* Rule of thirds grid */}
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex-1 border-b border-white/[0.04]" />
                  <div className="flex-1 border-b border-white/[0.04]" />
                  <div className="flex-1" />
                </div>
                <div className="absolute inset-0 flex">
                  <div className="flex-1 border-r border-white/[0.04]" />
                  <div className="flex-1 border-r border-white/[0.04]" />
                  <div className="flex-1" />
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="h-20 border-t border-white/[0.06] bg-[#111118] flex items-center justify-between px-4 pb-safe-area-bottom">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
           {['Auto', 'B&W', 'Sharpen', 'Warm', 'Cool'].map((f) => (
             <button 
               key={f}
               onClick={() => setFilter(f)}
               className="flex flex-col items-center gap-1 min-w-[48px]"
             >
               <div className={`size-8 rounded-full border flex items-center justify-center transition-all
                  ${filter === f ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0a0a0f] border-transparent bg-indigo-600' : 'border-white/[0.1] bg-white/[0.04]'}
               `}>
                 {/* Visual rep of filter */}
                 <div className={`size-full rounded-full opacity-50 
                   ${f === 'B&W' ? 'bg-zinc-400' : f === 'Warm' ? 'bg-amber-500' : f === 'Cool' ? 'bg-blue-400' : 'bg-transparent'}
                 `} />
               </div>
               <span className={`text-[10px] ${filter === f ? 'text-white' : 'text-zinc-500'}`}>{f}</span>
             </button>
           ))}
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-white/[0.06]">
          <IconButton icon="rotate_right" />
          <IconButton icon="crop" />
          <IconButton icon="tune" />
        </div>
      </div>
    </div>
  );
};

const IconButton = ({ icon }: { icon: string }) => (
  <button className="size-8 rounded-lg hover:bg-white/[0.04] text-zinc-400 flex items-center justify-center">
    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
  </button>
);

export default EditScreen;
