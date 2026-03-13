import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.echo.app',
  appName: 'Echo',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FAF7F2',
    },
  },
};

export default config;
