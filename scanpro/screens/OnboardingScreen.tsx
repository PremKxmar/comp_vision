import React from 'react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-[#0a0a0f] animate-fade-up">
      <div className="w-full max-w-[480px] flex flex-col gap-10">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500" style={{ fontSize: 32 }}>document_scanner</span>
          <h1 className="text-xl font-semibold text-white">ScanPro</h1>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-6">
          <FeatureRow 
            icon="auto_fix_high" 
            title="Shadow Removal" 
            desc="AI-powered shadow detection removes lighting artifacts automatically"
          />
          <FeatureRow 
            icon="crop_free" 
            title="Auto Edge Detection" 
            desc="Detects document boundaries and corrects perspective distortion"
          />
          <FeatureRow 
            icon="picture_as_pdf" 
            title="PDF Export" 
            desc="Combine multiple scanned pages into a single PDF document"
          />
        </div>

        {/* Action */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={onComplete}
            className="w-full bg-indigo-600 hover:bg-indigo-500 h-10 rounded-lg text-sm font-medium text-white transition-all active:scale-[0.97]"
          >
            Get Started
          </button>
          <p className="text-[11px] text-zinc-600 text-center">
            Powered by OpenCV + Classical Computer Vision
          </p>
        </div>

      </div>
    </div>
  );
};

const FeatureRow = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="flex items-start gap-4">
    <div className="size-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
      <span className="material-symbols-outlined text-zinc-300" style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default OnboardingScreen;
