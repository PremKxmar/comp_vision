import React from 'react';
import { Screen } from '../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
  const items = [
    { id: 'library', label: 'Documents', icon: 'folder' },
    { id: 'camera', label: 'Scanner', icon: 'document_scanner' },
    { id: 'tools', label: 'Tools', icon: 'build' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#111118] border-t border-white/[0.06] flex items-center justify-around px-2 z-50 safe-area-bottom">
      {items.map((item) => {
        const isActive = currentScreen === item.id || (currentScreen === 'result' && item.id === 'camera');
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Screen)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
          >
            <span 
              className={`material-symbols-outlined text-[24px] ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}
            >
              {item.icon}
            </span>
            <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
