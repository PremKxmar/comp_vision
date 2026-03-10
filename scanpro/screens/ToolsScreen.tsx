import React from 'react';

const ToolsScreen = () => {
  const tools = [
    { icon: 'text_fields', label: 'OCR', desc: 'Extract text' },
    { icon: 'draw', label: 'Sign', desc: 'Add signature' },
    { icon: 'badge', label: 'ID Card', desc: 'Front & back scan' },
    { icon: 'qr_code_scanner', label: 'QR Reader', desc: 'Decode codes' },
    { icon: 'merge', label: 'Merge PDF', desc: 'Combine files' },
    { icon: 'lock', label: 'Protect', desc: 'Encrypt PDF' },
    { icon: 'photo_library', label: 'Import', desc: 'Image to PDF' },
    { icon: 'burst_mode', label: 'Batch Scan', desc: 'Multiple pages' },
  ];

  return (
    <div className="animate-fade-up pb-20">
      <h1 className="text-xl font-semibold text-white">Tools</h1>
      <p className="text-sm text-zinc-500 mb-6 mt-1">Document utilities and advanced features</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tools.map((tool) => (
          <div 
            key={tool.label}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer group"
          >
            <div className="size-9 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-indigo-400">{tool.icon}</span>
            </div>
            <h3 className="text-sm font-medium text-zinc-200">{tool.label}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{tool.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolsScreen;
