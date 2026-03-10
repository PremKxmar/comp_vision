import React, { useEffect } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0f] animate-fade-up">
      <div className="flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-indigo-500" style={{ fontSize: 40 }}>document_scanner</span>
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white tracking-tight">ScanPro</h1>
          <p className="text-sm text-zinc-500 mt-1">Shadow-Robust Document Scanner</p>
        </div>
        <div className="mt-6 size-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    </div>
  );
};

export default SplashScreen;
