import React, { useEffect, useState } from 'react';
import { checkHealth } from '../services/api';
import { clearAllDocuments } from '../store';

interface SettingsScreenProps {
  onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const [apiStatus, setApiStatus] = useState<'Checking' | 'Connected' | 'Offline'>('Checking');
  
  useEffect(() => {
    checkHealth().then(ok => setApiStatus(ok ? 'Connected' : 'Offline'));
  }, []);

  const handleClearData = () => {
    if (window.confirm("Are you sure? This will delete all scanned documents.")) {
      clearAllDocuments();
      alert("Data cleared.");
      window.location.reload();
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full pb-20 animate-fade-up">
      <h1 className="text-xl font-semibold text-white mb-6">Settings</h1>

      <div className="flex flex-col gap-8">
        
        {/* Scan Prefs */}
        <Section title="Scan Preferences">
           <Row 
             icon="tune" color="text-blue-400" label="Scan Quality" 
             right={<span className="text-xs text-zinc-500">High</span>} 
           />
           <Row 
             icon="auto_fix_high" color="text-purple-400" label="Auto-enhance" 
             right={<Switch initial={true} />} 
           />
           <Row 
             icon="wb_sunny" color="text-amber-400" label="Shadow Removal" 
             right={<Switch initial={true} />} 
           />
        </Section>

        {/* Export */}
        <Section title="Export">
           <Row 
             icon="description" color="text-zinc-400" label="Default Format" 
             right={<span className="text-xs text-zinc-500 font-medium">PDF</span>} 
           />
           <Row 
             icon="straighten" color="text-zinc-400" label="Page Size" 
             right={<span className="text-xs text-zinc-500 font-medium">A4</span>} 
           />
        </Section>

        {/* About */}
        <Section title="About">
           <Row 
             icon="info" color="text-zinc-400" label="Version" 
             right={<span className="text-xs text-zinc-500">4.0.1</span>} 
           />
           <Row 
             icon="dns" color="text-zinc-400" label="Backend Status" 
             right={
               <span className={`text-xs font-medium ${apiStatus === 'Connected' ? 'text-emerald-400' : 'text-red-400'}`}>
                 {apiStatus}
               </span>
             } 
           />
           <div 
             onClick={handleClearData}
             className="h-11 px-4 flex items-center justify-between cursor-pointer hover:bg-red-500/5 transition-colors group"
           >
             <div className="flex items-center gap-3">
               <span className="material-symbols-outlined text-[18px] text-red-500 opacity-80 group-hover:opacity-100">delete_forever</span>
               <span className="text-sm text-red-500 opacity-80 group-hover:opacity-100">Clear All Data</span>
             </div>
           </div>
        </Section>

      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2 pl-1">{title}</h3>
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {children}
    </div>
  </div>
);

const Row = ({ icon, color, label, right }: any) => (
  <div className="h-11 px-4 flex items-center justify-between border-b border-white/[0.04] last:border-0">
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
    {right}
  </div>
);

const Switch = ({ initial }: { initial: boolean }) => {
  const [on, setOn] = useState(initial);
  return (
    <button 
      onClick={() => setOn(!on)}
      className={`w-9 h-5 rounded-full relative transition-colors ${on ? 'bg-indigo-600' : 'bg-zinc-700'}`}
    >
      <div className={`absolute top-1 bottom-1 size-3 bg-white rounded-full transition-transform ${on ? 'left-5' : 'left-1'}`} />
    </button>
  );
};

export default SettingsScreen;
