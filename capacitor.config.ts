import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config for building an Android WebView APK that loads the hosted app.
// To build: `npx cap add android` then open in Android Studio.
const config: CapacitorConfig = {
  appId: "app.lovable.pulse",
  appName: "Pulse",
  webDir: ".output/public",
  server: {
    // Loads the hosted PWA inside the WebView. Replace with your published URL.
    url: "https://d1cdc786-0f1a-40f2-95c9-e94f5b1a057a.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0F172A",
    },
  },
};

export default config;
