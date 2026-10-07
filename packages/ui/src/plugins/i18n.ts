import { shallowRef, watch, type App } from "vue";
import { createI18n } from "vue-i18n";

import enUS from "../i18n/locales/en-US";
import {
  getPreference,
  setPreference,
} from '../composables/storage/usePreferenceManager';
import { UI_SETTINGS_KEYS } from "@prompt-optimizer/core";
import type { AppServices } from "../types/services";

// English is the only supported UI language
type SupportedLocale = "en-US";
const SUPPORTED_LOCALES: SupportedLocale[] = ["en-US"];

// Service reference
const servicesRef = shallowRef<AppServices | null>(null);

// Function to set the service reference
export function setI18nServices(services: AppServices) {
  servicesRef.value = services;
}

// Create the i18n instance
const i18n = createI18n({
  legacy: false,
  locale: "en-US" as SupportedLocale,
  fallbackLocale: "en-US",
  messages: {
    "en-US": enUS,
  },
});

function syncLocaleToElectronMain(locale: string) {
  if (typeof window === 'undefined') return;
  const api = window.electronAPI;
  if (!api?.app?.setLocale) return;

  // Best-effort sync. Desktop-only; web builds simply no-op.
  void api.app.setLocale(locale).catch((error) => {
    console.warn('[i18n] Failed to sync locale to Electron main process:', error);
  });
}

// Keep Electron main process informed so native menus (context menu, etc.)
// can follow the app's selected language.
watch(
  i18n.global.locale,
  (locale) => {
    const value = String(locale || '');
    if (!value) return;
    syncLocaleToElectronMain(value);
  },
  { immediate: true },
);

// Initialize the language settings
async function initializeLanguage() {
  try {
    if (!servicesRef.value) {
      console.warn("Services unavailable while initializing language, using default");
      return;
    }

    const defaultLocale: SupportedLocale = "en-US";
    const savedLanguage = await getPreference(
      servicesRef,
      UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
      defaultLocale,
    );

    if (SUPPORTED_LOCALES.includes(savedLanguage as SupportedLocale)) {
      i18n.global.locale.value = savedLanguage as SupportedLocale;
    } else {
      i18n.global.locale.value = defaultLocale;
      await setPreference(
        servicesRef,
        UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
        defaultLocale,
      );
    }
  } catch (error) {
    console.error("Failed to initialize language settings:", error);
    // Fall back to the default language
    i18n.global.locale.value = "en-US";
  }
}

// Export the plugin install function
export function installI18n(app: App) {
  initializeLanguage(); // Async initialization, does not block app startup
  app.use(i18n);
}

// Export the deferred initialization function - for scenarios such as the Extension that must wait for services to initialize
export async function initializeI18nWithStorage() {
  await initializeLanguage();
}

// Export the base install function - only installs the plugin, does not initialize the language
export function installI18nOnly(app: App) {
  app.use(i18n);
}

// Export the i18n instance
export { i18n };
