import React from 'react';

interface ViewerScreenProps {
  onBack: () => void;
  title: string;
  size: string;
  thumbnail?: string;
}

const ViewerScreen: React.FC<ViewerScreenProps> = ({ onBack, title, size, thumbnail }) => {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] animate-fade-up fixed inset-0 z-50">
      
      {/* Top Bar */}
      <div className="h-14 border-b border-white/[0.06] bg-[#111118] px-4 flex items-center gap-4">
        <button onClick={onBack} className="size-8 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-zinc-400">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
          <p className="text-[10px] text-zinc-500">{size}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl overflow-hidden border border-white/10">
          {thumbnail ? (
             <img src={thumbnail} alt={title} className="w-full h-auto object-contain max-h-[75vh]" />
          ) : (
            <div className="aspect-[3/4] flex items-center justify-center bg-zinc-900">
              <span className="material-symbols-outlined text-zinc-700" style={{ fontSize: 64 }}>image_not_supported</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="bg-[#111118] border border-white/[0.06] rounded-lg px-2 py-1 flex items-center gap-1 shadow-2xl">
          <ToolBtn icon="download" />
          <ToolBtn icon="share" />
          <ToolBtn icon="edit" />
          <div className="w-[1px] h-4 bg-white/[0.1] mx-1" />
          <ToolBtn icon="delete" danger />
        </div>
      </div>
    </div>
  );
};

const ToolBtn = ({ icon, danger }: { icon: string, danger?: boolean }) => (
  <button className={`size-8 rounded-md flex items-center justify-center hover:bg-white/[0.04] transition-colors ${danger ? 'text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
    <span className="material-symbols-outlined" style={{fontSize: 20}}>{icon}</span>
  </button>
);

export default ViewerScreen;
