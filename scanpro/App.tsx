import React, { useState, useEffect } from 'react';
import { Screen, DocumentItem } from './types';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import BottomNav from './components/BottomNav';
import { getDocument } from './store';

// Screens
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LibraryScreen from './screens/LibraryScreen';
import CameraScreen from './screens/CameraScreen';
import EditScreen from './screens/EditScreen';
import ResultScreen from './screens/ResultScreen';
import ViewerScreen from './screens/ViewerScreen';
import SettingsScreen from './screens/SettingsScreen';
import ToolsScreen from './screens/ToolsScreen';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [viewDocData, setViewDocData] = useState<DocumentItem | null>(null);

  // Initial check for onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('scanpro_onboarding');
    if (screen === 'splash') {
       // Wait for splash to finish (handled by onFinish prop)
    }
  }, [screen]);

  const handleSplashFinish = () => {
    const hasSeenOnboarding = localStorage.getItem('scanpro_onboarding');
    setScreen(hasSeenOnboarding ? 'library' : 'onboarding');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('scanpro_onboarding', 'true');
    setScreen('library');
  };

  const handleViewDoc = (id: string) => {
    const doc = getDocument(id);
    if (doc) {
      setViewDocData(doc);
      setScreen('viewer');
    }
  };

  // Fullscreen modes that don't show nav/sidebar
  const isFullScreen = ['splash', 'onboarding', 'camera', 'edit', 'result', 'viewer'].includes(screen);

  // Render content logic
  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen onFinish={handleSplashFinish} />;
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} />;
      case 'library':
        return <LibraryScreen onScan={() => setScreen('camera')} onViewDoc={handleViewDoc} />;
      case 'camera':
        return <CameraScreen onCapture={() => setScreen('edit')} onCancel={() => setScreen('library')} />;
      case 'edit':
        return <EditScreen onDone={() => setScreen('result')} onBack={() => setScreen('camera')} />;
      case 'result':
        return <ResultScreen onAddPage={() => setScreen('camera')} onRetake={() => setScreen('camera')} onFinish={() => setScreen('library')} />;
      case 'viewer':
        return viewDocData ? (
          <ViewerScreen 
            title={viewDocData.title} 
            size={viewDocData.size} 
            thumbnail={viewDocData.thumbnail} 
            onBack={() => setScreen('library')} 
          />
        ) : null;
      case 'settings':
        return <SettingsScreen onBack={() => setScreen('library')} />;
      case 'tools':
        return <ToolsScreen />;
      default:
        return <LibraryScreen onScan={() => setScreen('camera')} onViewDoc={handleViewDoc} />;
    }
  };

  if (isFullScreen) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        {renderScreen()}
      </div>
    );
  }

  // Dashboard Layout
  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white font-display overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar 
        currentScreen={screen} 
        onNavigate={setScreen} 
        onNewScan={() => setScreen('camera')} 
      />
      
      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Mobile Header */}
        <TopHeader 
          title={screen} 
          onNewScan={() => setScreen('camera')} 
        />
        
        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative no-scrollbar">
          <div className="max-w-7xl mx-auto h-full">
            {renderScreen()}
          </div>
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav 
          currentScreen={screen} 
          onNavigate={setScreen} 
        />
      </div>
    </div>
  );
}
