import React, { useState, useEffect } from 'react';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { CameraScreen } from './screens/CameraScreen';
import { EditScreen } from './screens/EditScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ViewerScreen } from './screens/ViewerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { BottomNav } from './components/BottomNav';
import { getDocument } from './store';
import { Screen, ThemeContextType } from './types';
import { ScanResult } from './services/api';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [scannedPages, setScannedPages] = useState<string[]>([]); // Multi-page support

  // Initialize theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const themeContext: ThemeContextType = { isDark, toggleTheme };

  const handleNavigate = (s: Screen) => {
    setScreen(s);
  };

  const handleViewDoc = (id: string) => {
    setSelectedDocId(id);
    setScreen('viewer');
  };

  const handleScanComplete = (result: ScanResult) => {
    setLastScanResult(result);
    // Add scanned image to pages collection
    if (result.scan) {
      setScannedPages(prev => [...prev, result.scan!]);
    }
    setScreen('result');
  };

  const handleAddPage = () => {
    // Go to camera to add another page
    setScreen('camera');
  };

  const handleFinishDocument = () => {
    // Clear pages collection when done
    setScannedPages([]);
    setLastScanResult(null);
    setScreen('library');
  };

  const getDoc = () => {
    if (!selectedDocId) return null;
    return getDocument(selectedDocId);
  };

  // Rendering logic based on screen state
  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen onFinish={() => setScreen('onboarding')} />;
      case 'onboarding':
        return <OnboardingScreen onComplete={() => setScreen('library')} />;
      case 'camera':
        return <CameraScreen onCapture={handleScanComplete} onCancel={() => setScreen('library')} />;
      case 'edit':
        return <EditScreen onDone={() => setScreen('result')} onBack={() => setScreen('camera')} />;
      case 'result':
        return (
          <ResultScreen
            onAddPage={handleAddPage}
            onRetake={() => {
              // Remove last page when retaking
              setScannedPages(prev => prev.slice(0, -1));
              setScreen('camera');
            }}
            onFinish={handleFinishDocument}
            scanResult={lastScanResult}
            scannedPages={scannedPages}
          />
        );
      case 'viewer':
        const doc = getDoc();
        if (!doc) return <LibraryScreen onScan={() => setScreen('camera')} onViewDoc={handleViewDoc} />;
        return <ViewerScreen onBack={() => setScreen('library')} title={doc.title} size={doc.size} thumbnail={doc.thumbnail} />;
      case 'settings':
        return <SettingsScreen onBack={() => setScreen('library')} themeContext={themeContext} />;
      case 'tools':
        return (
          <>
            <ToolsScreen />
            <BottomNav currentScreen="tools" onNavigate={handleNavigate} />
          </>
        );
      case 'library':
      default:
        return (
          <>
            <LibraryScreen onScan={() => setScreen('camera')} onViewDoc={handleViewDoc} />
            <BottomNav currentScreen="library" onNavigate={handleNavigate} />
          </>
        );
    }
  };

  return (
    <div className="w-full h-full min-h-screen relative bg-black">
      {renderScreen()}
    </div>
  );
}
