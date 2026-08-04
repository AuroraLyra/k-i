import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'top.babylink.app',
  appName: 'BabyLink',
  webDir: 'dist',
  server: {
    url: 'https://babylink.top/home',
    cleartext: false,
    allowNavigation: ['babylink.top']
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true
    },
    LocalNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list']
    }
  }
};

export default config;