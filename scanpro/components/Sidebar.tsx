import React, { useEffect, useState } from 'react';
import { Screen } from '../types';
import { checkHealth } from '../services/api';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onNewScan: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, onNewScan }) => {
  const [apiOnline, setApiOnline] = useState<boolean>(false);

  useEffect(() => {
    checkHealth().then(setApiOnline);
  }, []);

  const navItems = [
    { id: 'library', label: 'Documents', icon: 'folder' },
    { id: 'camera', label: 'Scanner', icon: 'document_scanner' },
    { id: 'tools', label: 'Tools', icon: 'build' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 h-full bg-[#111118] border-r border-white/[0.06] flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500" style={{ fontSize: 24 }}>document_scanner</span>
          <span className="text-base font-semibold text-white tracking-tight">ScanPro</span>
        </div>
        <span className="text-[10px] text-zinc-600 pl-8">v4.0</span>
      </div>

      {/* Primary Action */}
      <div className="mx-4 mb-6">
        <button
          onClick={onNewScan}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg h-9 text-sm font-medium shadow-[0_0_20px_-4px_rgba(99,102,241,0.4)] transition-all active:scale-[0.97]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          New Scan
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 flex-1">
        <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-2 mb-2">Workspace</div>
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id || (currentScreen === 'result' && item.id === 'camera');
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Screen)}
                className={`h-8 px-2 rounded-md flex items-center gap-2.5 text-sm cursor-pointer transition-colors relative w-full text-left
                  ${isActive ? 'text-white bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-indigo-500 rounded-r-sm" />
                )}
                <span className={`material-symbols-outlined ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} style={{ fontSize: 20 }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Status */}
      <div className="mt-auto px-4 py-4 border-t border-white/[0.06] flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-xs text-zinc-500">
          {apiOnline ? 'API Connected' : 'API Offline'}
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
