import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scanpro.app',
  appName: 'ScanPro',
  webDir: 'dist',
  server: {
    // Allow all origins for API calls
    allowNavigation: ['*'],
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;

