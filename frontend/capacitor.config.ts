import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geotransportes.app',
  appName: 'GeoTransporte',
  webDir: 'build'
};

// SplashScreen plugin defaults — adjust values as needed
config.plugins = {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: '#FFFFFFFF',
    androidScaleType: 'CENTER_CROP',
    showSpinner: false,
    splashFullScreen: true,
    splashImmersive: true
  }
};

export default config;
