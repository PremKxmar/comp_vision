import React from 'react';

interface TopHeaderProps {
  title: string;
  onNewScan: () => void;
}

const TopHeader: React.FC<TopHeaderProps> = ({ title, onNewScan }) => {
  return (
    <header className="lg:hidden sticky top-0 z-40 h-14 bg-[#111118] border-b border-white/[0.06] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {/* Placeholder for menu */}
        <span className="material-symbols-outlined text-zinc-400">menu</span>
        <h1 className="text-sm font-semibold text-white capitalize">{title}</h1>
      </div>
      <button 
        onClick={onNewScan}
        className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>document_scanner</span>
      </button>
    </header>
  );
};

export default TopHeader;
