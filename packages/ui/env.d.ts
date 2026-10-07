/// <reference types="vite/client" />

declare module '*.vue' {
  import { type DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

// Vite already provides built-in environment variable types via /// <reference types="vite/client" />

// E2E: test helper variables injected into window
interface Window {
  __TEST_DB_NAME__?: string
}

// Import Electron type definitions
/// <reference path="./src/types/electron.d.ts" />
