import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'dev.threej.engine',
  appName: 'ThreeJ',
  webDir:  'dist',
  server: {
    // Use https scheme on Android so WebViewAssetLoader serves with proper
    // MIME types (including application/wasm for Rapier).
    androidScheme: 'https',
  },
  ios: {
    // WKWebView on iOS 15+ supports WebGL 2.0 and WASM natively.
    contentInset: 'always',
  },
  android: {
    // allowMixedContent needed if you load any http resources (none by default).
    allowMixedContent: false,
  },
}

export default config
