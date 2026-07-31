import type { CapacitorConfig } from '@capacitor/cli';

// Empacotamento do app para Android. O `dist` é embutido no APK, então o app abre
// offline e não depende do GitHub Pages estar no ar.
const config: CapacitorConfig = {
  appId: 'br.com.dumbfood.app',
  appName: 'dumbfood',
  webDir: 'dist',
  android: {
    // A importação por link passa por proxies https; nada é servido por http puro.
    allowMixedContent: false,
  },
};

export default config;
