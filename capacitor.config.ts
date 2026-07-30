import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.babylink.app',
  appName: 'BabyLink',
  webDir: 'dist',
  server: {
    url: 'https://babylink.top',
    appStartPath: '/home',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true
    },
    SystemBars: {
      style: 'LIGHT',
      hidden: true,
      animation: 'NONE',
      insetsHandling: 'css'
    },
    LocalNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list']
    }
  }
};

export default config;