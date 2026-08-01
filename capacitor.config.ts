import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
      resize: KeyboardResize.Native,
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