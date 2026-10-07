/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Initialize the logging system before all other modules
const ConsoleLogger = require('./config/console-logger');
const consoleLogger = new ConsoleLogger();

// Set up global error handlers immediately, so any exception can be recorded
consoleLogger.setupGlobalErrorHandlers();

const { app, BrowserWindow, ipcMain, shell, session, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  buildReleaseUrl,
  validateVersion,
  IPC_EVENTS,
  PREFERENCE_KEYS,
  DEFAULT_CONFIG
} = require('./config/update-config');
const path = require('path');

// Determine the correct config file path
// In production, look for the .env.local file in the directory of the exe first
let envLocalPath;
if (app.isPackaged) {
  // Production: the directory of the exe
  envLocalPath = path.join(process.resourcesPath, '..', '.env.local');
} else {
  // Development: the project root directory
  envLocalPath = path.resolve(__dirname, '../../.env.local');
}

const envPath = path.join(__dirname, '.env');

// Load environment variables
require('dotenv').config({ path: envLocalPath });
require('dotenv').config({ path: envPath });


const {
  PreferenceService,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createLLMService,
  createPromptService,
  createImageModelManager,
  createImageAdapterRegistry,
  createImageService,
  createTemplateLanguageService,
  createDataManager,
  createContextRepo,
  FavoriteManager,
  FileStorageProvider,
  // Import the shared environment variable scanning constants
  CUSTOM_API_PATTERN,
  SUFFIX_PATTERN,
  MAX_SUFFIX_LENGTH,
} = require('@prompt-optimizer/core');

/**
 * Safe serialization function used to clean Vue reactive objects
 * Ensures that all objects passed over IPC are plain JavaScript objects
 *
 * This function solves the IPC serialization problem, which differs from the data consistency problem of the storage layer:
 * - IPC problem: Vue reactive objects cannot be serialized and passed by Electron
 * - Storage problem: the data consistency and recovery mechanisms of FileStorageProvider
 */
function safeSerialize(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitive types are returned directly
  if (typeof obj !== 'object') {
    return obj;
  }

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('[IPC Serialization] Failed to serialize object:', error);
    throw new Error(`Failed to serialize object for IPC: ${error.message}`);
  }
}

let mainWindow;
let modelManager, templateManager, historyManager, llmService, promptService, templateLanguageService, preferenceService, dataManager, contextRepo, favoriteManager;
let imageModelManager, imageService;
let imageAdapterRegistry; // Global reference for the IPC handlers to use
let storageProvider; // Global storage provider reference, used to save data on exit

// The current UI language (decided by the renderer process i18n selection).
// Note: Electron does not provide the browser-style right-click editing menu for input boxes by default,
// so we pop up the menu ourselves in the main process, and use this locale to decide the menu text.
let uiLocale = null;

const SUPPORTED_UI_LOCALES = new Set(['en-US']);

function normalizeUiLocale(locale) {
  if (typeof locale !== 'string' || !locale) return null;
  if (SUPPORTED_UI_LOCALES.has(locale)) return locale;

  if (locale.toLowerCase().startsWith('en')) return 'en-US';
  return null;
}

function getCurrentUiLocale() {
  const fromUi = normalizeUiLocale(uiLocale);
  if (fromUi) return fromUi;

  try {
    const fromSystem = typeof app.getLocale === 'function' ? app.getLocale() : null;
    return normalizeUiLocale(fromSystem) || 'en-US';
  } catch (_e) {
    return 'en-US';
  }
}

const CONTEXT_MENU_LABELS = {
  'en-US': {
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
  },
};

function getContextMenuLabels(locale) {
  const normalized = normalizeUiLocale(locale) || 'en-US';
  return CONTEXT_MENU_LABELS[normalized] || CONTEXT_MENU_LABELS['en-US'];
}
let isQuitting = false; // Flag preventing duplicate data saves
let isUpdaterQuitting = false; // Marks an exit for update installation, skipping the data save
let forceQuitTimer = null; // Force-quit timer
const MAX_SAVE_TIME = 5000; // Maximum save time: 5 seconds
let emergencyExitTimer = null; // Emergency exit timer
const EMERGENCY_EXIT_TIME = 10000; // Emergency exit time: 10 seconds

// Emergency exit mechanism: exit within 10 seconds no matter what
function setupEmergencyExit() {
  if (emergencyExitTimer) {
    clearTimeout(emergencyExitTimer);
  }

  emergencyExitTimer = setTimeout(() => {
    console.error('[DESKTOP] EMERGENCY EXIT: Force terminating process after 10 seconds');
    process.exit(1); // Force-terminate the process
  }, EMERGENCY_EXIT_TIME);
}

// === System Proxy → Undici Global Dispatcher (Plan A1) ===
// Note: set the undici global proxy dispatcher as early as possible in the main process, so Node/SDK requests reuse the system proxy.
// Safety: any failing step is skipped gracefully and never affects the startup flow.
async function setupGlobalProxyDispatcherFromSystem() {
  // Load undici dynamically, compatible with different Node/Electron versions
  let undici;
  try {
    try {
      undici = require('undici');
    } catch (_) {
      undici = require('node:undici');
    }
  } catch (e) {
    console.log('[Proxy] undici is unavailable, skipping the global proxy setup');
    return; // Skip directly when undici is missing, without affecting startup
  }

  const { setGlobalDispatcher, ProxyAgent, Agent } = undici || {};
  if (!setGlobalDispatcher || !ProxyAgent) {
    console.log('[Proxy] undici does not support setGlobalDispatcher/ProxyAgent, skipping');
    return;
  }

  // Resolve the Electron system proxy (including PAC/WPAD)
  // Pick a common external target to resolve; fall back to a direct connection if resolution fails.
  let proxyDecision = 'DIRECT';
  let rawResolve = 'DIRECT';
  try {
    // Make sure the session is available (must be called after app ready)
    const targetUrl = 'https://www.example.com';
    const result = await session.defaultSession.resolveProxy(targetUrl);
    // result looks like: "PROXY host:port; SOCKS5 host:port; DIRECT"
    rawResolve = result || 'DIRECT';
    proxyDecision = rawResolve.split(';')[0].trim();
  } catch (e) {
    console.log('[Proxy] Failed to resolve the system proxy, using a direct connection:', e && e.message);
    proxyDecision = 'DIRECT';
  }

  // Map the proxy decision to a proxy URL for undici
  // Supports: PROXY/HTTPS/SOCKS/SOCKS5/DIRECT
  let dispatcher;
  let mappedProxyUrl = 'DIRECT';
  try {
    if (proxyDecision.startsWith('PROXY ') || proxyDecision.startsWith('HTTPS ')) {
      const hostPort = proxyDecision.split(' ')[1]; // host:port
      mappedProxyUrl = `http://${hostPort}`;
      dispatcher = new ProxyAgent(mappedProxyUrl);
    } else if (proxyDecision.startsWith('SOCKS5 ')) {
      const hostPort = proxyDecision.split(' ')[1];
      mappedProxyUrl = `socks5://${hostPort}`;
      dispatcher = new ProxyAgent(mappedProxyUrl);
    } else if (proxyDecision.startsWith('SOCKS ')) {
      const hostPort = proxyDecision.split(' ')[1];
      mappedProxyUrl = `socks://${hostPort}`;
      dispatcher = new ProxyAgent(mappedProxyUrl);
    } else {
      // DIRECT or unknown: use the default direct Agent
      dispatcher = new Agent();
    }

    setGlobalDispatcher(dispatcher);
    // Basic logs (always output)
    console.log('[Proxy] System proxy resolution result (raw):', rawResolve);
    console.log('[Proxy] Selected decision (decision):', proxyDecision);
    console.log('[Proxy] undici global proxy:', mappedProxyUrl);

    // Diagnostic info (only output when enabled by an environment variable)
    const debug = process.env.DEBUG_PROXY === '1' || process.env.PROXY_DEBUG === '1';
    if (debug) {
      console.log('[Proxy][DEBUG] Environment variable: HTTPS_PROXY=', process.env.HTTPS_PROXY || '');
      console.log('[Proxy][DEBUG] Environment variable: HTTP_PROXY =', process.env.HTTP_PROXY || '');
      console.log('[Proxy][DEBUG] Environment variable: NO_PROXY   =', process.env.NO_PROXY || '');
      console.log('[Proxy][DEBUG] Node/Electron versions:', {
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome
      });
    }
  } catch (e) {
    console.log('[Proxy] Failed to set the global proxy dispatcher, using a direct connection:', e && e.message);
    try {
      const { Agent } = undici;
      if (Agent) setGlobalDispatcher(new Agent());
    } catch (_) { /* no-op */ }
  }
}

async function initializePreferenceService(storageProvider) {
  console.log('[DESKTOP] Initializing PreferenceService with the provided storage provider...');
  preferenceService = new PreferenceService(storageProvider);
  console.log('[DESKTOP] PreferenceService initialized.');
}

function setupPreferenceHandlers() {
  ipcMain.handle('preference-get', async (event, key, defaultValue) => {
    try {
      const value = await preferenceService.get(key, defaultValue);
      return createSuccessResponse(value);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-set', async (event, key, value) => {
    try {
      await preferenceService.set(key, value);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-getAll', async (event) => {
    try {
      const result = await preferenceService.getAll();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Preference Import/Export Data handlers (for bulk operations)
  ipcMain.handle('preference-exportData', async (event) => {
    try {
      const result = await preferenceService.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-importData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      await preferenceService.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-getDataType', async (event) => {
    try {
      const result = preferenceService.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('preference-validateData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      const result = await preferenceService.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

// Build the runtime config script injected into the renderer process (two sets of keys: with and without the prefix)
function buildRuntimeConfigScriptFromEnv() {
  try {
    const entries = Object.entries(process.env)
      .filter(([k, v]) => k.startsWith('VITE_') && v !== undefined && v !== null && String(v).length > 0);

    const props = [];
    for (const [k, v] of entries) {
      const val = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const noPrefix = k.replace(/^VITE_/, '');
      props.push([noPrefix, val]);
      props.push([k, val]);
    }

    const body = props.map(([key, val]) => `  ${key}: "${val}"`).join(',\n');

    return `// Injected by Electron main process\n`
      + `window.runtime_config = Object.assign({}, (window.runtime_config || {}), {\n`
      + `${body}\n`
      + `});\n`
      + `console.log('[Main Process] runtime_config injected with ${entries.length} VITE_* vars (dual keys)');\n`;
  } catch (e) {
    return `console.warn('[Main Process] Failed to build runtime_config:', ${JSON.stringify(String(e))});`;
  }
}

function createWindow() {
  // Create the browser window.
  // Choose an appropriate icon file for the platform
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'icons', 'app-icon.ico');
  } else if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'icons', 'app-icon.icns');
  } else {
    // Linux and other platforms: prefer the high-resolution PNG
    const linuxIcons = [
      path.join(__dirname, 'icons', '512x512.png'),
      path.join(__dirname, 'icons', '256x256.png'),
      path.join(__dirname, 'icons', 'app-icon.png')
    ];
    iconPath = linuxIcons.find(icon => require('fs').existsSync(icon)) || linuxIcons[2];
  }

  // Check whether the icon file exists
  if (require('fs').existsSync(iconPath)) {
    console.log('[Main Process] Using icon:', iconPath);
  } else {
    console.warn('[Main Process] Icon file not found:', iconPath);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath, // Set the window icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Enable native-like context menu for text inputs (cut/copy/paste/selectAll).
  // Electron doesn't provide this by default, which makes right-click paste
  // unavailable on Windows.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const isEditable = Boolean(params.isEditable);
    const selectionText = typeof params.selectionText === 'string' ? params.selectionText : '';
    const hasSelection = selectionText.trim().length > 0;

    const labels = getContextMenuLabels(getCurrentUiLocale());

    // Avoid showing an empty menu on right-click.
    if (!isEditable && !hasSelection) return;

    const editFlags = params.editFlags || {};

    const template = isEditable
      ? [
          { label: labels.undo, role: 'undo', enabled: Boolean(editFlags.canUndo) },
          { label: labels.redo, role: 'redo', enabled: Boolean(editFlags.canRedo) },
          { type: 'separator' },
          { label: labels.cut, role: 'cut', enabled: Boolean(editFlags.canCut) },
          { label: labels.copy, role: 'copy', enabled: Boolean(editFlags.canCopy) },
          { label: labels.paste, role: 'paste', enabled: Boolean(editFlags.canPaste) },
          { type: 'separator' },
          { label: labels.selectAll, role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) },
        ]
      : [
          { label: labels.copy, role: 'copy', enabled: hasSelection },
          { type: 'separator' },
          { label: labels.selectAll, role: 'selectAll' },
        ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow, x: params.x, y: params.y });
  });

  // In development, we can point to the vite dev server
  if (process.env.NODE_ENV === 'development') {
    console.log('[Main Process] Running in development mode, loading from Vite dev server');
    mainWindow.loadURL('http://localhost:18181');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built file from the web package
    const webDistPath = path.join(__dirname, 'web-dist/index.html');
    console.log('[Main Process] Loading web app from:', webDistPath);
    if (require('fs').existsSync(webDistPath)) {
      mainWindow.loadFile(webDistPath);
    } else {
      console.error('[Main Process] Web dist not found at:', webDistPath);
      console.error('[Main Process] Please run: pnpm run build:web and ensure it is copied to the desktop package.');
    }
  }

  // Save data before the window closes
  mainWindow.on('close', async (event) => {
    // If this is an exit for update installation, close the window directly without saving data
    if (isUpdaterQuitting) {
      console.log('[DESKTOP] Updater quit detected, skipping data save');
      return;
    }

    if (!isQuitting && storageProvider && typeof storageProvider.flush === 'function') {
      event.preventDefault(); // Prevent closing immediately
      isQuitting = true; // Set the quit flag

      // Start the emergency exit mechanism
      setupEmergencyExit();

      // Set the force-quit timer to make sure the program does not hang
      forceQuitTimer = setTimeout(() => {
        console.warn('[DESKTOP] Force closing window due to timeout');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      }, MAX_SAVE_TIME);

      try {
        console.log('[DESKTOP] Saving data before window close...');
        await Promise.race([
          storageProvider.flush(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Save timeout')), MAX_SAVE_TIME - 1000)
          )
        ]);
        console.log('[DESKTOP] Data saved successfully');
      } catch (error) {
        console.error('[DESKTOP] Failed to save data before close:', error);
      } finally {
        if (forceQuitTimer) {
          clearTimeout(forceQuitTimer);
          forceQuitTimer = null;
        }
        if (emergencyExitTimer) {
          clearTimeout(emergencyExitTimer);
          emergencyExitTimer = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      }
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object
    mainWindow = null;
  });
}

async function initializeServices() {
  try {
    console.log('[Main Process] Initializing core services...');
    
    // Set environment variables so the main process can access the API keys
    // These environment variables should be set before starting the desktop app
    console.log('[Main Process] Checking environment variables...');

    // Static environment variables
    const staticEnvVars = [
      'VITE_OPENAI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'VITE_ANTHROPIC_API_KEY',
      'VITE_DEEPSEEK_API_KEY',
      'VITE_SILICONFLOW_API_KEY',
      'VITE_ZHIPU_API_KEY',
      'VITE_DASHSCOPE_API_KEY',
      'VITE_OPENROUTER_API_KEY',
      'VITE_MODELSCOPE_API_KEY',
      'VITE_CUSTOM_API_KEY',
      'VITE_CUSTOM_API_BASE_URL',
      'VITE_CUSTOM_API_MODEL'
    ];

    // Scan dynamic custom model environment variables
    // Use the unified regular expression pattern and validation rules

    const dynamicEnvVars = Object.keys(process.env).filter(key => {
      const match = key.match(CUSTOM_API_PATTERN);
      if (!match) return false;

      const [, , suffix] = match;
      return suffix && suffix.length <= MAX_SUFFIX_LENGTH && SUFFIX_PATTERN.test(suffix);
    });

    const allEnvVars = [...staticEnvVars, ...dynamicEnvVars];

    let hasApiKeys = false;
    allEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`[Main Process] Found ${envVar}: [CONFIGURED]`);
        hasApiKeys = true;
      } else {
        console.log(`[Main Process] Missing ${envVar}`);
      }
    });

    if (dynamicEnvVars.length > 0) {
      console.log(`[Main Process] Found ${dynamicEnvVars.length} dynamic custom model environment variables`);
    }
    
    if (!hasApiKeys) {
      console.warn('[Main Process] No API keys found in environment variables.');
      console.warn('[Main Process] Please set environment variables before starting the desktop app.');
      console.warn('[Main Process] Examples:');
      console.warn('[Main Process]   VITE_OPENAI_API_KEY=your_key_here npm start');
      console.warn('[Main Process]   VITE_CUSTOM_API_KEY_qwen3=your_qwen_key npm start');
      console.warn('[Main Process]   VITE_CUSTOM_API_KEY_claude=your_claude_key npm start');
    }
    
    console.log('[DESKTOP] Creating file storage provider for desktop environment');

    // Use the standard user data directory to support auto-update
    const userDataPath = app.getPath('userData');
    console.log('[DESKTOP] Using standard user data directory for auto-update compatibility:', userDataPath);
    storageProvider = new FileStorageProvider(userDataPath);
    
    await initializePreferenceService(storageProvider);
    
    console.log('[DESKTOP] Creating model manager...');
    modelManager = createModelManager(storageProvider);
    
    console.log('[DESKTOP] Creating template language service...');
    templateLanguageService = createTemplateLanguageService(preferenceService);

    console.log('[DESKTOP] Initializing template language service...');
    await templateLanguageService.initialize();

    console.log('[DESKTOP] Creating template manager...');
    templateManager = createTemplateManager(storageProvider, templateLanguageService);
    
    console.log('[DESKTOP] Creating history manager...');
    historyManager = createHistoryManager(storageProvider, modelManager);
    
    console.log('[DESKTOP] Initializing model manager...');
    await modelManager.ensureInitialized();
    // Image model manager
    console.log('[DESKTOP] Creating image model manager...');
    imageAdapterRegistry = createImageAdapterRegistry();
    imageModelManager = createImageModelManager(storageProvider, imageAdapterRegistry);
    await imageModelManager.ensureInitialized();
    
    // Before creating any network-related service, set the undici global dispatcher based on the system proxy settings
    await setupGlobalProxyDispatcherFromSystem();

    console.log('[DESKTOP] Creating LLM service...');
    llmService = createLLMService(modelManager);

    console.log('[DESKTOP] Creating Prompt service...');
    promptService = createPromptService(modelManager, llmService, templateManager, historyManager);
    console.log('[DESKTOP] Creating Image service...');
    imageService = createImageService(imageModelManager, imageAdapterRegistry);
    
    console.log('[DESKTOP] Creating Context repository...');
    contextRepo = createContextRepo(storageProvider);

    console.log('[DESKTOP] Creating Data manager...');
    dataManager = createDataManager(modelManager, templateManager, historyManager, preferenceService, contextRepo);

    console.log('[DESKTOP] Creating Favorite manager...');
    favoriteManager = new FavoriteManager(storageProvider);
    
    console.log('[Main Process] Core services initialized successfully.');
    
    return true;
  } catch (error) {
    console.error('[Main Process] Failed to initialize core services:', error);
    console.error('[Main Process] Error details:', error.stack);
    return false;
  }
}

// --- IPC Response Helpers ---
function createSuccessResponse(data) {
  return { success: true, data };
}

function createErrorResponse(error) {
  console.error('[Main Process IPC Error]', error);
  // Always return a structured error payload so renderer can translate via `code + params`.
  // This is safe even for legacy callers because preload normalizes both string/object.
  return { success: false, error: normalizeIpcError(error) };
}

// Structured error payload for renderer-side i18n (code + params).
function normalizeIpcError(error) {
  const message = error instanceof Error ? error.message : String(error);

  const payload = { message };

  if (error && typeof error === 'object') {
    if (typeof error.code === 'string') {
      payload.code = error.code;
    }

    if (error.params && typeof error.params === 'object') {
      try {
        payload.params = safeSerialize(error.params);
      } catch (_) {
        // Best-effort only; omit params if serialization fails.
      }
    }
  }

  return payload;
}

function createStructuredErrorResponse(error) {
  // Backward-compat: keep the helper name used by newer handlers.
  return createErrorResponse(error)
}

// Create a detailed error response to ensure 100% information fidelity
function createDetailedErrorResponse(error) {
  const timestamp = new Date().toISOString();
  let detailedMessage = `[${timestamp}] Error Details:\n\n`;

  // Serialize the error info in detail
  if (error instanceof Error) {
    detailedMessage += `Message: ${error.message}\n`;

    if (error.name && error.name !== 'Error') {
      detailedMessage += `Type: ${error.name}\n`;
    }

    if (error.code) {
      detailedMessage += `Code: ${error.code}\n`;
    }

    if (error.statusCode) {
      detailedMessage += `HTTP Status: ${error.statusCode}\n`;
    }

    if (error.url) {
      detailedMessage += `URL: ${error.url}\n`;
    }

    if (error.stack) {
      detailedMessage += `\nStack Trace:\n${error.stack}\n`;
    }

    // Capture other possible properties
    const otherProps = {};
    for (const key in error) {
      if (!['message', 'name', 'code', 'statusCode', 'url', 'stack'].includes(key)) {
        try {
          otherProps[key] = error[key];
        } catch (e) {
          otherProps[key] = `[Cannot serialize: ${e.message}]`;
        }
      }
    }

    if (Object.keys(otherProps).length > 0) {
      detailedMessage += `\nAdditional Properties:\n${JSON.stringify(otherProps, null, 2)}\n`;
    }
  } else {
    // Handling for non-Error objects
    detailedMessage += `Value: ${String(error)}\n`;
    detailedMessage += `Type: ${typeof error}\n`;
  }

  // Fallback: full JSON serialization
  try {
    const jsonError = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    if (jsonError && jsonError !== '{}' && jsonError !== 'null') {
      detailedMessage += `\nComplete Object Dump:\n${jsonError}`;
    }
  } catch (jsonError) {
    detailedMessage += `\nJSON Serialization Failed: ${jsonError.message}`;
  }

  // Also output detailed info to the console
  console.error('[Detailed Error Info]', detailedMessage);

  return { success: false, error: detailedMessage };
}

function formatFavoriteError(error) {
  if (!error || typeof error !== 'object') {
    return { message: String(error || 'Unknown error'), code: 'UNKNOWN_ERROR' };
  }

  const formatted = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    name: error.name || 'Error'
  };

  if (error.details) {
    formatted.details = error.details;
  }

  if (error.cause) {
    formatted.cause = {
      message: error.cause.message || String(error.cause),
      code: error.cause.code,
      name: error.cause.name
    };
  }

  return formatted;
}

function createFavoriteErrorResponse(error) {
  console.error('[Favorite IPC Error]', error);
  return { success: false, error: formatFavoriteError(error) };
}

// --- High-Level IPC Service Handlers ---
function setupIPC() {
  console.log('[Main Process] Setting up high-level service IPC handlers...');
  setupPreferenceHandlers();
  
  // LLM Service handlers
  ipcMain.handle('llm-testConnection', async (event, provider) => {
    try {
      await llmService.testConnection(provider);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('llm-sendMessage', async (event, messages, provider) => {
    try {
      const result = await llmService.sendMessage(messages, provider);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('llm-sendMessageStructured', async (event, messages, provider) => {
    try {
      const result = await llmService.sendMessageStructured(messages, provider);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('llm-fetchModelList', async (event, provider, customConfig) => {
    try {
      const result = await llmService.fetchModelList(provider, customConfig);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Streaming handler - more complex due to callbacks
  ipcMain.handle('llm-sendMessageStream', async (event, messages, provider, streamId) => {
    try {
      // Use callback names that match the StreamHandlers interface
      const callbacks = {
        onToken: (token) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-content-${streamId}`, token);
          }
        },
        onReasoningToken: (thinking) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-thinking-${streamId}`, thinking);
          }
        },
        onComplete: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-finish-${streamId}`);
          }
        },
        onError: (error) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-error-${streamId}`, error.message);
          }
        }
      };

      await llmService.sendMessageStream(messages, provider, callbacks);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Streaming handler with tools - supports tool-call events
  ipcMain.handle('llm-sendMessageStreamWithTools', async (event, messages, provider, tools, streamId) => {
    try {
      const callbacks = {
        onToken: (token) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-content-${streamId}`, token);
          }
        },
        onReasoningToken: (thinking) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-thinking-${streamId}`, thinking);
          }
        },
        onToolCall: (toolCall) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-tool-call-${streamId}`, toolCall);
          }
        },
        onComplete: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-finish-${streamId}`);
          }
        },
        onError: (error) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            event.sender.send(`stream-error-${streamId}`, error.message);
          }
        }
      };

      await llmService.sendMessageStreamWithTools(messages, provider, tools, callbacks);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Prompt Service handlers
  ipcMain.handle('prompt-optimizePrompt', async (event, request) => {
    try {
      const result = await promptService.optimizePrompt(request);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-iteratePrompt', async (event, originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId) => {
    try {
      const result = await promptService.iteratePrompt(originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-testPrompt', async (event, systemPrompt, userPrompt, modelKey) => {
    try {
      const result = await promptService.testPrompt(systemPrompt, userPrompt, modelKey);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-getHistory', async () => {
    try {
      const result = await historyManager.getHistory();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-getIterationChain', async (event, recordId) => {
    try {
      const result = await historyManager.getIterationChain(recordId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Helper for creating stream handlers that send data to the renderer process
  const createIpcStreamHandlers = (window, streamId) => ({
    onToken: (token) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(`stream-token-${streamId}`, token);
      }
    },
    onReasoningToken: (token) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(`stream-reasoning-token-${streamId}`, token);
      }
    },
    onToolCall: (toolCall) => {
      // Tool call events use a separate channel
      if (window && !window.isDestroyed()) {
        window.webContents.send(`stream-tool-call-${streamId}`, toolCall);
      }
    },
    onComplete: () => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(`stream-finish-${streamId}`);
      }
    },
    onError: (error) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(`stream-error-${streamId}`, error.message);
      }
    },
  });

  ipcMain.handle('prompt-optimizePromptStream', async (event, request, streamId) => {
    const streamHandlers = createIpcStreamHandlers(mainWindow, streamId);
    try {
      await promptService.optimizePromptStream(request, streamHandlers);
      return createSuccessResponse(null);
    } catch (error) {
      streamHandlers.onError(error);
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-iteratePromptStream', async (event, originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, streamId, contextData) => {
    const streamHandlers = createIpcStreamHandlers(mainWindow, streamId);
    try {
      await promptService.iteratePromptStream(originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, streamHandlers, templateId, contextData);
      return createSuccessResponse(null);
    } catch (error) {
      streamHandlers.onError(error);
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('prompt-testPromptStream', async (event, systemPrompt, userPrompt, modelKey, streamId) => {
    const streamHandlers = createIpcStreamHandlers(mainWindow, streamId);
    try {
      await promptService.testPromptStream(systemPrompt, userPrompt, modelKey, streamHandlers);
      return createSuccessResponse(null);
    } catch (error) {
      streamHandlers.onError(error);
      return createErrorResponse(error);
    }
  });

  // Intercept /config.js before the page loads and inject runtime environment variables (two sets of keys)
  try {
    const ses = (mainWindow && mainWindow.webContents && mainWindow.webContents.session) || session.defaultSession;
    if (ses && ses.webRequest && typeof ses.webRequest.onBeforeRequest === 'function') {
      const filter = { urls: ['*://*/*', 'file://*/*'] };
      ses.webRequest.onBeforeRequest(filter, (details, callback) => {
        if (/\/config\.js(\?.*)?$/i.test(details.url)) {
          const script = buildRuntimeConfigScriptFromEnv();
          const dataUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(script);
          return callback({ redirectURL: dataUrl });
        }
        return callback({});
      });
      console.log('[Main Process] Runtime config (config.js) interceptor registered');
    }
  } catch (e) {
    console.warn('[Main Process] Unable to register runtime config interceptor:', e);
  }

  // Custom conversation test (supports tools, variables, conversation messages)
  ipcMain.handle('prompt-testCustomConversationStream', async (event, request, streamId) => {
    const streamHandlers = createIpcStreamHandlers(mainWindow, streamId);
    try {
      await promptService.testCustomConversationStream(request, streamHandlers);
      return createSuccessResponse(null);
    } catch (error) {
      streamHandlers.onError(error);
      return createErrorResponse(error);
    }
  });

  // Model Manager handlers
  ipcMain.handle('model-getModels', async (event) => {
    try {
      const result = await modelManager.getAllModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-addModel', async (event, model) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeModel = safeSerialize(model);
      // model should contain key and config, which need to be separated
      const { key, ...config } = safeModel;
      await modelManager.addModel(key, config);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-updateModel', async (event, id, updates) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeUpdates = safeSerialize(updates);
      await modelManager.updateModel(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-deleteModel', async (event, id) => {
    try {
      await modelManager.deleteModel(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-ensureInitialized', async () => {
    try {
      await modelManager.ensureInitialized();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-isInitialized', async () => {
    try {
      const result = await modelManager.isInitialized();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getAllModels', async () => {
    try {
      const result = await modelManager.getAllModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getEnabledModels', async (event) => {
    try {
      const result = await modelManager.getEnabledModels();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Model Import/Export Data handlers (for bulk operations)
  ipcMain.handle('model-exportData', async (event) => {
    try {
      const result = await modelManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // ===== Image Model handlers (Config-centric) =====
  ipcMain.handle('image-model-ensureInitialized', async () => {
    try { await imageModelManager.ensureInitialized(); return createSuccessResponse(null) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-isInitialized', async () => {
    try { const r = await imageModelManager.isInitialized(); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-getAllConfigs', async () => {
    try { const r = await imageModelManager.getAllConfigs(); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-getConfig', async (e, id) => {
    try { const r = await imageModelManager.getConfig(id); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-addConfig', async (e, config) => {
    try { const safeCfg = safeSerialize(config); await imageModelManager.addConfig(safeCfg); return createSuccessResponse(null) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-updateConfig', async (e, id, updates) => {
    try { const safe = safeSerialize(updates); await imageModelManager.updateConfig(id, safe); return createSuccessResponse(null) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-deleteConfig', async (e, id) => {
    try { await imageModelManager.deleteConfig(id); return createSuccessResponse(null) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-getEnabledConfigs', async () => {
    try { const r = await imageModelManager.getEnabledConfigs(); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-exportData', async () => {
    try { const r = await imageModelManager.exportData(); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-importData', async (e, data) => {
    try { const safe = safeSerialize(data); await imageModelManager.importData(safe); return createSuccessResponse(null) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-getDataType', async () => {
    try { const r = await imageModelManager.getDataType(); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })
  ipcMain.handle('image-model-validateData', async (e, data) => {
    try { const safe = safeSerialize(data); const r = await imageModelManager.validateData(safe); return createSuccessResponse(r) }
    catch (error) { return createErrorResponse(error) }
  })

  // ===== Image Service handlers =====
  ipcMain.handle('image-generate', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.generate(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  // Explicit mode: avoid implicitly inferring from whether inputImage is present
  ipcMain.handle('image-generateText2Image', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.generateText2Image(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  ipcMain.handle('image-generateImage2Image', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.generateImage2Image(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  ipcMain.handle('image-validateRequest', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.validateRequest(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  ipcMain.handle('image-validateText2ImageRequest', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.validateText2ImageRequest(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  ipcMain.handle('image-validateImage2ImageRequest', async (e, request) => {
    try {
      const safeReq = safeSerialize(request)
      const res = await imageService.validateImage2ImageRequest(safeReq)
      return createSuccessResponse(res)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  // New: connection test (runs in the main process, avoiding network requests in the renderer)
  ipcMain.handle('image-testConnection', async (e, config) => {
    try {
      const safeCfg = safeSerialize(config)
      // Reuse ImageService.testConnection to keep behavior consistent with Web:
      // - merges param overrides
      // - enforces base64-only input for image2image tests
      const result = await imageService.testConnection(safeCfg)
      return createSuccessResponse(result)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  // New: dynamic model fetching (runs in the main process)
  ipcMain.handle('image-getDynamicModels', async (e, providerId, connectionConfig) => {
    try {
      const safeConn = safeSerialize(connectionConfig)
      const models = await imageAdapterRegistry.getDynamicModels(providerId, safeConn)
      return createSuccessResponse(models)
    } catch (error) {
      return createStructuredErrorResponse(error)
    }
  })

  ipcMain.handle('model-importData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      await modelManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-getDataType', async (event) => {
    try {
      const result = modelManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('model-validateData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      const result = await modelManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template Manager handlers
  ipcMain.handle('template-getTemplates', async (event) => {
    try {
      const result = await templateManager.listTemplates();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getTemplate', async (event, id) => {
    try {
      const result = await templateManager.getTemplate(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-createTemplate', async (event, template) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeTemplate = safeSerialize(template);
      await templateManager.saveTemplate(safeTemplate);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-updateTemplate', async (event, id, updates) => {
    try {
      // Get existing template and merge with updates
      const existingTemplate = await templateManager.getTemplate(id);
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeUpdates = safeSerialize(updates);
      const updatedTemplate = { ...existingTemplate, ...safeUpdates, id };
      await templateManager.saveTemplate(updatedTemplate);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-deleteTemplate', async (event, id) => {
    try {
      await templateManager.deleteTemplate(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-listTemplatesByType', async (event, type) => {
    try {
      const result = await templateManager.listTemplatesByType(type);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template Import/Export handlers
  ipcMain.handle('template-exportTemplate', async (event, id) => {
    try {
      const result = await templateManager.exportTemplate(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-importTemplate', async (event, jsonString) => {
    try {
      await templateManager.importTemplate(jsonString);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template Import/Export Data handlers (for bulk operations)
  ipcMain.handle('template-exportData', async (event) => {
    try {
      const result = await templateManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-importData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      await templateManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getDataType', async (event) => {
    try {
      const result = templateManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-validateData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      const result = templateManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Template language handlers
  ipcMain.handle('template-changeBuiltinTemplateLanguage', async (event, language) => {
    try {
      await templateManager.changeBuiltinTemplateLanguage(language);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getCurrentBuiltinTemplateLanguage', async (event) => {
    try {
      const result = await templateManager.getCurrentBuiltinTemplateLanguage();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getSupportedBuiltinTemplateLanguages', async (event) => {
    try {
      const result = await templateManager.getSupportedBuiltinTemplateLanguages();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('template-getSupportedLanguages', async (event, template) => {
    try {
      const result = templateManager.getSupportedLanguages(template);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // History Manager handlers
  ipcMain.handle('history-getHistory', async (event) => {
    try {
      const result = await historyManager.getRecords();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-addRecord', async (event, record) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeRecord = safeSerialize(record);
      const result = await historyManager.addRecord(safeRecord);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-deleteRecord', async (event, id) => {
    try {
      await historyManager.deleteRecord(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-clearHistory', async (event) => {
    try {
      await historyManager.clearHistory();
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Add the missing history chain features
  ipcMain.handle('history-getIterationChain', async (event, recordId) => {
    try {
      const result = await historyManager.getIterationChain(recordId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getAllChains', async (event) => {
    try {
      const result = await historyManager.getAllChains();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getChain', async (event, chainId) => {
    try {
      const result = await historyManager.getChain(chainId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-createNewChain', async (event, record) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeRecord = safeSerialize(record);
      const result = await historyManager.createNewChain(safeRecord);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-addIteration', async (event, params) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeParams = safeSerialize(params);
      const result = await historyManager.addIteration(safeParams);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-deleteChain', async (event, chainId) => {
    try {
      await historyManager.deleteChain(chainId);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // History Import/Export Data handlers (for bulk operations)
  ipcMain.handle('history-exportData', async (event) => {
    try {
      const result = await historyManager.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-importData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      await historyManager.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-getDataType', async (event) => {
    try {
      const result = historyManager.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('history-validateData', async (event, data) => {
    try {
      // Clean Vue reactive objects to prevent IPC serialization errors
      const safeData = safeSerialize(data);
      const result = await historyManager.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Context Repository handlers
  ipcMain.handle('context-list', async (event) => {
    try {
      const result = await contextRepo.list();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-getCurrentId', async (event) => {
    try {
      const result = await contextRepo.getCurrentId();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-setCurrentId', async (event, id) => {
    try {
      await contextRepo.setCurrentId(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-get', async (event, id) => {
    try {
      const result = await contextRepo.get(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-create', async (event, meta) => {
    try {
      const safeMeta = meta ? safeSerialize(meta) : undefined;
      const result = await contextRepo.create(safeMeta);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-duplicate', async (event, id, options) => {
    try {
      const safeOptions = options ? safeSerialize(options) : undefined;
      const result = await contextRepo.duplicate(id, safeOptions);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-rename', async (event, id, title) => {
    try {
      await contextRepo.rename(id, title);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-save', async (event, ctx) => {
    try {
      const safeCtx = safeSerialize(ctx);
      await contextRepo.save(safeCtx);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-update', async (event, id, patch) => {
    try {
      const safePatch = safeSerialize(patch);
      await contextRepo.update(id, safePatch);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-remove', async (event, id) => {
    try {
      await contextRepo.remove(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-exportAll', async (event) => {
    try {
      const result = await contextRepo.exportAll();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-importAll', async (event, bundle, mode) => {
    try {
      const safeBundle = safeSerialize(bundle);
      const result = await contextRepo.importAll(safeBundle, mode);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-exportData', async (event) => {
    try {
      const result = await contextRepo.exportData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-importData', async (event, data) => {
    try {
      const safeData = safeSerialize(data);
      await contextRepo.importData(safeData);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-getDataType', async (event) => {
    try {
      const result = contextRepo.getDataType();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('context-validateData', async (event, data) => {
    try {
      const safeData = safeSerialize(data);
      const result = await contextRepo.validateData(safeData);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Favorite Manager handlers
  ipcMain.handle('favorite-addFavorite', async (event, favorite) => {
    try {
      const safeFavorite = safeSerialize(favorite);
      const result = await favoriteManager.addFavorite(safeFavorite);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getFavorites', async (event, options) => {
    try {
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.getFavorites(safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getFavorite', async (event, id) => {
    try {
      const result = await favoriteManager.getFavorite(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-updateFavorite', async (event, id, updates) => {
    try {
      const safeUpdates = safeSerialize(updates);
      await favoriteManager.updateFavorite(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteFavorite', async (event, id) => {
    try {
      await favoriteManager.deleteFavorite(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteFavorites', async (event, ids) => {
    try {
      const safeIds = safeSerialize(ids);
      await favoriteManager.deleteFavorites(safeIds);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-incrementUseCount', async (event, id) => {
    try {
      await favoriteManager.incrementUseCount(id);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getCategories', async () => {
    try {
      const result = await favoriteManager.getCategories();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-addCategory', async (event, category) => {
    try {
      const safeCategory = safeSerialize(category);
      const result = await favoriteManager.addCategory(safeCategory);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-updateCategory', async (event, id, updates) => {
    try {
      const safeUpdates = safeSerialize(updates);
      await favoriteManager.updateCategory(id, safeUpdates);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteCategory', async (event, id) => {
    try {
      const result = await favoriteManager.deleteCategory(id);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getStats', async () => {
    try {
      const result = await favoriteManager.getStats();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-searchFavorites', async (event, keyword, options) => {
    try {
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.searchFavorites(keyword, safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-exportFavorites', async (event, ids) => {
    try {
      const safeIds = safeSerialize(ids);
      const result = await favoriteManager.exportFavorites(safeIds || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-importFavorites', async (event, data, options) => {
    try {
      const safeData = typeof data === 'string' ? data : safeSerialize(data);
      const safeOptions = safeSerialize(options);
      const result = await favoriteManager.importFavorites(safeData, safeOptions || undefined);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getAllTags', async () => {
    try {
      const result = await favoriteManager.getAllTags();
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-addTag', async (event, tag) => {
    try {
      await favoriteManager.addTag(tag);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-renameTag', async (event, oldTag, newTag) => {
    try {
      const result = await favoriteManager.renameTag(oldTag, newTag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-mergeTags', async (event, sourceTags, targetTag) => {
    try {
      const safeSourceTags = safeSerialize(sourceTags);
      const result = await favoriteManager.mergeTags(safeSourceTags, targetTag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-deleteTag', async (event, tag) => {
    try {
      const result = await favoriteManager.deleteTag(tag);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-reorderCategories', async (event, categoryIds) => {
    try {
      const safeCategoryIds = safeSerialize(categoryIds);
      await favoriteManager.reorderCategories(safeCategoryIds);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-getCategoryUsage', async (event, categoryId) => {
    try {
      const result = await favoriteManager.getCategoryUsage(categoryId);
      return createSuccessResponse(result);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  ipcMain.handle('favorite-ensureDefaultCategories', async (event, defaultCategories) => {
    try {
      const safeCategories = safeSerialize(defaultCategories);
      await favoriteManager.ensureDefaultCategories(safeCategories);
      return createSuccessResponse(null);
    } catch (error) {
      return createFavoriteErrorResponse(error);
    }
  });

  // Data Manager handlers
  ipcMain.handle('data-exportAllData', async (event) => {
    try {
      const result = await dataManager.exportAllData();
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('data-importAllData', async (event, dataString) => {
    try {
      await dataManager.importAllData(dataString);
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Desktop: storage helpers for Data Manager UI
  ipcMain.handle('data-getStorageInfo', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const mainFilePath = path.join(userDataPath, 'prompt-optimizer-data.json');
      const backupFilePath = path.join(userDataPath, 'prompt-optimizer-data.json.backup');

      const statSafe = async (p) => {
        try {
          const s = await require('fs').promises.stat(p);
          return typeof s?.size === 'number' ? s.size : 0;
        } catch {
          return 0;
        }
      };

      const mainSizeBytes = await statSafe(mainFilePath);
      const backupSizeBytes = await statSafe(backupFilePath);

      return createSuccessResponse({
        userDataPath,
        mainFilePath,
        mainSizeBytes,
        backupFilePath,
        backupSizeBytes,
        totalBytes: mainSizeBytes + backupSizeBytes,
      });
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('data-openStorageDirectory', async () => {
    try {
      const userDataPath = app.getPath('userData');
      await shell.openPath(userDataPath);
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(error);
    }
  });



  // Environment config sync - the main process is the single source of config
  ipcMain.handle('config-getEnvironmentVariables', async (event) => {
    try {
      // Automatically pass through all VITE_* variables and add unprefixed copies
      const viteEnv = Object.fromEntries(
        Object.entries(process.env)
          .filter(([k, v]) => k.startsWith('VITE_') && v !== undefined)
          .map(([k, v]) => [k, String(v)])
      );

      const noPrefixEnv = Object.fromEntries(
        Object.entries(viteEnv).map(([k, v]) => [k.replace(/^VITE_/, ''), v])
      );

      const allEnvVars = { ...viteEnv, ...noPrefixEnv };

      console.log('[Main Process] Environment variables requested by UI process');
      console.log(`[Main Process] Returning ${Object.keys(viteEnv).length} VITE_* variables (with no-prefix duplicates)`);

      return createSuccessResponse(allEnvVars);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // External link handler
  ipcMain.handle('shell-openExternal', async (event, url) => {
    try {
      console.log('[Main Process] Opening external URL:', url);
      // Security check: only allow the http/https protocols
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`Unsupported protocol: ${urlObj.protocol}`);
      }
      await shell.openExternal(url);
      return createSuccessResponse(true);
    } catch (error) {
      console.error('[Main Process] Failed to open external URL:', error);
      return createErrorResponse(error);
    }
  });

  // App info handler
  ipcMain.handle('app-get-version', () => {
    try {
      const packageJson = require('./package.json');
      return createSuccessResponse(packageJson.version);
    } catch (error) {
      console.error('[Main Process] Failed to get app version:', error);
      return createErrorResponse(error);
    }
  });

  // UI locale sync (renderer -> main)
  // Used to localize Electron-only UI like context menus.
  ipcMain.handle('app-set-locale', (_event, locale) => {
    try {
      uiLocale = normalizeUiLocale(locale) || 'en-US';
      return createSuccessResponse(null);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Log-related handlers
  ipcMain.handle('logs-get-paths', () => {
    try {
      const paths = consoleLogger.getLogPaths();
      return createSuccessResponse(paths);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  ipcMain.handle('logs-open-directory', async () => {
    try {
      const { logDir } = consoleLogger.getLogPaths();
      await shell.openPath(logDir);
      return createSuccessResponse(true);
    } catch (error) {
      return createErrorResponse(error);
    }
  });

  // Auto-update-related handlers
  setupUpdateHandlers();

  console.log('[Main Process] High-level service IPC handlers ready.');
}

// This method is called when Electron has finished initialization.
app.whenReady().then(async () => {
  const servicesInitialized = await initializeServices();
  if (servicesInitialized) {
    // The IPC listeners must be set up before creating the window
    // To prevent code in the window from sending IPC messages before the listeners are ready
    setupIPC();
    createWindow();
  } else {
    console.error('[Main Process] Failed to start application due to service initialization failure.');
    // Optionally, show a dialog to the user
    // dialog.showErrorBox('Application Error', 'Could not initialize critical services.');
    app.quit();
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Process signal handlers - the last safeguard
process.on('SIGINT', () => {
  console.log('[DESKTOP] Received SIGINT, forcing exit...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[DESKTOP] Received SIGTERM, forcing exit...');
  process.exit(0);
});

// The global exception handling is already set up in console-logger

// Save data before the app quits
app.on('before-quit', async (event) => {
  // If this is an exit for update installation, quit directly without saving data
  if (isUpdaterQuitting) {
    console.log('[DESKTOP] Updater quit detected, allowing immediate quit');
    return;
  }

  if (!isQuitting && storageProvider && typeof storageProvider.flush === 'function') {
    event.preventDefault(); // Prevent quitting immediately
    isQuitting = true; // Set the quit flag

    // Start the emergency exit mechanism
    setupEmergencyExit();

    // Set the force-quit timer to make sure the app does not hang
    const forceAppQuitTimer = setTimeout(() => {
      console.warn('[DESKTOP] Force quitting app due to timeout');
      process.exit(0); // Force-exit the process
    }, MAX_SAVE_TIME);

    try {
      console.log('[DESKTOP] Saving data before quit...');
      await Promise.race([
        storageProvider.flush(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Save timeout')), MAX_SAVE_TIME - 1000)
        )
      ]);
      console.log('[DESKTOP] Data saved successfully');
    } catch (error) {
      console.error('[DESKTOP] Failed to save data before quit:', error);
    } finally {
      clearTimeout(forceAppQuitTimer);
      if (emergencyExitTimer) {
        clearTimeout(emergencyExitTimer);
        emergencyExitTimer = null;
      }
      // Use setImmediate to make sure we exit in the next event loop
      setImmediate(() => {
        isQuitting = false; // Reset the flag to allow a normal exit
        app.quit(); // Quit manually
      });
    }
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Ignored-version management helper functions (global scope)
const getIgnoredVersions = async () => {
  try {
    const ignoredVersions = await preferenceService.get(PREFERENCE_KEYS.IGNORED_VERSIONS, null);
    if (ignoredVersions && typeof ignoredVersions === 'object') {
      return ignoredVersions;
    }
    return { stable: null, prerelease: null };
  } catch (error) {
    console.warn('[Updater] Failed to read ignored versions, using defaults:', error);
    return { stable: null, prerelease: null };
  }
};

const isVersionIgnored = async (version) => {
  const ignoredVersions = await getIgnoredVersions();
  const versionType = version.includes('-') ? 'prerelease' : 'stable';

  // Check the ignored version of the corresponding type
  if (versionType === 'stable' && ignoredVersions.stable === version) {
    return true;
  }
  if (versionType === 'prerelease' && ignoredVersions.prerelease === version) {
    return true;
  }

  return false;
};

// Auto-update handler setup
async function setupUpdateHandlers() {
  console.log('[Main Process] Setting up auto-update handlers...');



  // Update operation state locks, preventing concurrent calls
  let isCheckingForUpdate = false;
  let isDownloadingUpdate = false;
  let isInstallingUpdate = false;

  // Configure the basic updater settings
  autoUpdater.autoDownload = DEFAULT_CONFIG.autoDownload;
  autoUpdater.allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
  autoUpdater.allowDowngrade = false; // Downgrade is not allowed by default; only temporarily enabled when switching channels

  // Environment variable dynamic config support (public repositories only)
  const defaultRepo = 'linshenkx/prompt-optimizer';
  let currentRepo = null;

  // Detect the repository info in the environment variables
  if (process.env.GITHUB_REPOSITORY) {
    currentRepo = process.env.GITHUB_REPOSITORY;
  } else if (process.env.DEV_REPO_OWNER && process.env.DEV_REPO_NAME) {
    currentRepo = `${process.env.DEV_REPO_OWNER}/${process.env.DEV_REPO_NAME}`;
  }

  // If the repository in the environment variables differs from the default one, use setFeedURL for dynamic config
  if (currentRepo && currentRepo !== defaultRepo) {
    try {
      const [owner, repo] = currentRepo.split('/');

      const feedConfig = {
        provider: 'github',
        owner,
        repo,
        private: false // Only public repositories are supported
      };

      console.log('[Updater] Using custom repository configuration:', {
        owner,
        repo,
        private: false,
        source: 'environment variables'
      });

      autoUpdater.setFeedURL(feedConfig);
    } catch (configError) {
      console.error('[Updater] Failed to configure custom repository:', configError);
      console.log('[Updater] Falling back to default configuration');
    }
  } else {
    console.log('[Updater] Using default repository configuration:', defaultRepo);
  }

  // Update check config in development mode
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    console.log('[Updater] Development mode detected');
    
    // Set up a dedicated logger for the development environment (officially recommended)
    const log = require('electron-log');
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'debug';
    autoUpdater.logger.transports.console.level = 'debug';
    
    // Create a dedicated log file for the updater
    const userDataPath = app.getPath('userData');
    autoUpdater.logger.transports.file.resolvePathFn = () => 
      path.join(userDataPath, 'logs', 'auto-updater.log');
    
    // Force-enable update checks in development mode
    autoUpdater.forceDevUpdateConfig = true;
    
    console.log('[Updater] Development mode configuration:');
    console.log('[Updater] - forceDevUpdateConfig: true');
    console.log('[Updater] - Looking for dev-app-update.yml in:', path.join(__dirname, 'dev-app-update.yml'));
    console.log('[Updater] - dev-app-update.yml exists:', require('fs').existsSync(path.join(__dirname, 'dev-app-update.yml')));
    
    console.log('[Updater] Development mode update testing enabled');
    console.log('[Updater] Auto-updater logs will be saved to:', path.join(userDataPath, 'logs', 'auto-updater.log'));
  }

  // Set up the update event handlers - only once at app startup
  autoUpdater.on('update-available', async (info) => {
    console.log('[Updater] Update available:', info);

    try {
      // Validate the version number format
      if (!validateVersion(info.version)) {
        console.error('[Updater] Invalid version format:', info.version);
        return;
      }

      // Check whether the version is ignored
      try {
        const isIgnored = await isVersionIgnored(info.version);
        if (isIgnored) {
          console.log('[Updater] Ignoring version:', info.version);
          return;
        }
      } catch (prefError) {
        console.warn('[Updater] Failed to check ignored versions, continuing with update check:', prefError);
        // Continue without interrupting the update flow
      }

      // Build a safe GitHub Release page link
      let releaseUrl;
      try {
        releaseUrl = buildReleaseUrl(info.version);
      } catch (urlError) {
        console.error('[Updater] Failed to build release URL:', urlError);
        // Use the fallback URL or skip the URL
        releaseUrl = null;
      }

      // Send the update-available notification to the UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.UPDATE_AVAILABLE_INFO, {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          releaseUrl: releaseUrl
        });
      }
    } catch (error) {
      console.error('[Updater] Critical error in update-available handler:', error);
      // Even on error, notify the user that an update is available, but without detailed info
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.UPDATE_AVAILABLE_INFO, {
          version: info.version || 'Unknown',
          releaseDate: info.releaseDate || null,
          releaseNotes: null,
          releaseUrl: null,
          error: 'Failed to process update information'
        });
      }
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] No update available:', info);
    // Note: this event listener is now mainly used for logging
    // The actual UI update logic has moved to the frontend's request-response pattern
    // This avoids race conditions and global state problems
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Update error:', error);

    // For a 403 error, provide basic debugging info
    if (error.code === 'HTTP_ERROR_403' || (error.message && error.message.includes('403'))) {
      console.log('[Updater Debug] ===== 403 ERROR DEBUGGING =====');
      console.log('[Updater Debug] This is a 403 Forbidden error, likely repository access issue');

      console.log('[Updater Debug] Common 403 causes:');
      console.log('[Updater Debug] 1. Repository is private (not supported)');
      console.log('[Updater Debug] 2. Repository does not exist');
      console.log('[Updater Debug] 3. Network/firewall blocking GitHub API');
      console.log('[Updater Debug] 4. GitHub API rate limiting');

      console.log('[Updater Debug] Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      console.log('[Updater Debug] =====================================');
    }

    // Reset all state locks to allow the user to retry
    isCheckingForUpdate = false;
    isDownloadingUpdate = false;
    isInstallingUpdate = false;

    // Create detailed error info
    const detailedErrorResponse = createDetailedErrorResponse(error);

    // Send the detailed error event to the UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.UPDATE_ERROR, {
        message: detailedErrorResponse.error,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log('[Updater] Download progress:', progress);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOAD_PROGRESS, progress);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info);
    console.log('[Updater] ===== UPDATE READY FOR INSTALLATION =====');
    console.log('[Updater] Downloaded version:', info.version);
    console.log('[Updater] Release date:', info.releaseDate);
    console.log('[Updater] Next step: User needs to click "Install and Restart" to complete the update');
    console.log('[Updater] The application will automatically restart after installation');
    console.log('[Updater] =============================================');
    
    // Download complete, reset the download state
    isDownloadingUpdate = false;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Send more detailed info to the frontend, including the install hint
      mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOADED, {
        ...info,
        message: 'Update downloaded successfully. Click "Install and Restart" to complete the installation.',
        needsRestart: true,
        canInstallNow: true,
        installAction: 'Click the install button to restart and apply the update'
      });
    }
  });

  // Check for updates - return the full result directly, avoiding global state
  ipcMain.handle(IPC_EVENTS.UPDATE_CHECK, async () => {
    // Check whether an update check is already in progress
    if (isCheckingForUpdate) {
      console.log('[Updater] Update check already in progress, ignoring request');
      return createSuccessResponse({
        message: 'Update check already in progress',
        inProgress: true
      });
    }

    // Set the check state lock
    isCheckingForUpdate = true;

    try {
      // Read the user preferences, using an error boundary and a clear fallback
      let allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
      try {
        allowPrerelease = await preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, DEFAULT_CONFIG.allowPrerelease);
        console.log('[Updater] Successfully read prerelease preference:', allowPrerelease);
      } catch (prefError) {
        console.warn('[Updater] PreferenceService unavailable, using safe default (stable releases only):', prefError);
        allowPrerelease = false; // Explicit safe default

        // Optional: notify the user that the preferences are unavailable
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('preference-service-warning', {
            message: 'Settings temporarily unavailable, using default configuration',
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log('[Updater] Checking for updates with settings:', { allowPrerelease });

      // Configure the updater
      autoUpdater.allowPrerelease = allowPrerelease;

      // Run the update check
      console.log('[Updater] Starting update check...');
      
      // Check the config before actually calling checkForUpdates
      console.log('[Updater Debug] ===== PRE-CHECK CONFIGURATION =====');
      console.log('[Updater Debug] autoUpdater.allowPrerelease:', autoUpdater.allowPrerelease);
      console.log('[Updater Debug] autoUpdater.autoDownload:', autoUpdater.autoDownload);
      console.log('[Updater Debug] ===============================================');
      
      const result = await autoUpdater.checkForUpdates();

      console.log('[DEBUG] ===== BACKEND UPDATE CHECK RESULT =====');
      console.log('[DEBUG] autoUpdater.checkForUpdates() returned:', result);
      console.log('[DEBUG] Result type:', typeof result);
      console.log('[DEBUG] Result is null:', result === null);
      console.log('[DEBUG] Result is undefined:', result === undefined);
      if (result) {
        console.log('[DEBUG] Result.updateInfo:', result.updateInfo);
        console.log('[DEBUG] Result.updateInfo type:', typeof result.updateInfo);
      }
      console.log('[DEBUG] ==========================================');

      // Build the complete response data, including all necessary info
      const currentVersion = require('./package.json').version;
      let responseData = {
        checkResult: result,
        currentVersion: currentVersion,
        hasUpdate: false,
        remoteVersion: null,
        remoteReleaseUrl: null,
        message: 'Update check completed'
      };

      if (result && result.updateInfo) {
        const updateInfo = result.updateInfo;
        responseData.remoteVersion = updateInfo.version;
        responseData.hasUpdate = updateInfo.version !== currentVersion;

        // Build the release page URL
        try {
          responseData.remoteReleaseUrl = buildReleaseUrl(updateInfo.version);
        } catch (urlError) {
          console.warn('[Updater] Failed to build release URL:', urlError);
        }

        if (responseData.hasUpdate) {
          responseData.message = `New version ${updateInfo.version} is available`;
        } else {
          responseData.message = `You are already using the latest version (${updateInfo.version})`;
        }

        console.log('[Updater] Successfully retrieved update info:', {
          remoteVersion: updateInfo.version,
          hasUpdate: responseData.hasUpdate,
          releaseUrl: responseData.remoteReleaseUrl
        });
      } else {
        // No remote version info was obtained, which may be a config or network problem
        console.log('[Updater] No update info received - checking possible causes...');

        // Production, or the development environment is configured but still no info was obtained
        console.warn('[Updater] No update info received - this may indicate a configuration or network issue');
        console.warn('[Updater] Possible causes:');
        console.warn('  - app-update.yml missing or misconfigured');
        console.warn('  - Network connectivity issues');
        console.warn('  - GitHub repository access issues');
        console.warn('  - Invalid repository configuration');

        responseData.message = 'Unable to check for updates - configuration or network issue';
        responseData.checkResult = null;
      }

      return createSuccessResponse(responseData);
    } catch (error) {
      console.error('[Updater] Check update failed:', error);
      const detailedResponse = createDetailedErrorResponse(error);
      console.error('[DEBUG] Detailed error response being sent:', detailedResponse);
      return detailedResponse;
    } finally {
      // Release the lock whether it succeeds or fails
      isCheckingForUpdate = false;
      console.log('[Updater] Update check completed, lock released');
    }
  });

  // Check all versions uniformly (solves the concurrency conflict problem)
  ipcMain.handle(IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS, async () => {
    console.log('[Updater] Starting unified version check for all versions');
    
    // Check whether an update check is already in progress
    if (isCheckingForUpdate) {
      console.log('[Updater] Update check already in progress, ignoring request');
      return createSuccessResponse({
        message: 'Update check already in progress',
        inProgress: true
      });
    }

    // Set the check state lock
    isCheckingForUpdate = true;

    try {
      // Get the current version
      const currentVersion = require('./package.json').version;
      const results = {
        currentVersion,
        stable: null,
        prerelease: null
      };

      // Helper function: handle a single version check result
      const processResult = (result, versionType) => {
        if (!result || !result.updateInfo) {
          console.log(`[Updater] No ${versionType} update available`);
          return {
            hasUpdate: false,
            remoteVersion: null,
            remoteReleaseUrl: null,
            message: `No ${versionType} update available`,
            versionType,
            noVersionFound: true
          };
        }

        const updateInfo = result.updateInfo;
        const remoteVersion = updateInfo.version;

        // When checking the preview version, filter out the stable version
        if (versionType === 'prerelease') {
          const isPrerelease = remoteVersion.includes('-');
          if (!isPrerelease) {
            return {
              hasUpdate: false,
              remoteVersion: null,
              remoteReleaseUrl: null,
              message: 'No newer prerelease available (latest release is stable)',
              versionType,
              noVersionFound: true,
              latestStableVersion: remoteVersion
            };
          }
        }

        // Simple but effective version comparison: let the frontend handle the complex semantic version comparison
        // Here we only need to make sure the remote version info is returned, and the frontend does the accurate version comparison
        const hasUpdate = remoteVersion !== currentVersion;

        console.log(`[Updater] Version check for ${versionType}:`, {
          currentVersion,
          remoteVersion,
          hasUpdate: hasUpdate ? 'possible (will be verified by frontend)' : 'no'
        });
        let remoteReleaseUrl = null;

        // Build the release page URL
        try {
          remoteReleaseUrl = buildReleaseUrl(updateInfo.version);
        } catch (urlError) {
          console.warn(`[Updater] Failed to build ${versionType} release URL:`, urlError);
        }

        console.log(`[Updater] ${versionType} version check result:`, {
          remoteVersion,
          hasUpdate,
          releaseUrl: remoteReleaseUrl
        });

        return {
          hasUpdate,
          remoteVersion,
          remoteReleaseUrl,
          message: hasUpdate ?
            `New ${versionType} version ${remoteVersion} is available` :
            `You are already using the latest ${versionType} version`,
          versionType,
          releaseDate: updateInfo.releaseDate,
          releaseNotes: updateInfo.releaseNotes
        };
      };

      // 1. Check the stable version
      console.log('[Updater] Checking stable version...');
      autoUpdater.allowPrerelease = false;
      
      try {
        const stableResult = await autoUpdater.checkForUpdates();
        results.stable = processResult(stableResult, 'stable');
      } catch (error) {
        console.error('[Updater] Stable version check failed:', error);
        results.stable = {
          hasUpdate: false,
          remoteVersion: null,
          remoteReleaseUrl: null,
          message: `Stable version check failed: ${error.message}`,
          versionType: 'stable',
          error: error.message
        };
      }

      // 2. Check the preview version after a delay (avoiding state conflicts)
      console.log('[Updater] Waiting before checking prerelease version...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('[Updater] Checking prerelease version...');
      autoUpdater.allowPrerelease = true;
      
      try {
        const prereleaseResult = await autoUpdater.checkForUpdates();
        results.prerelease = processResult(prereleaseResult, 'prerelease');
      } catch (error) {
        console.error('[Updater] Prerelease version check failed:', error);
        results.prerelease = {
          hasUpdate: false,
          remoteVersion: null,
          remoteReleaseUrl: null,
          message: `Prerelease version check failed: ${error.message}`,
          versionType: 'prerelease',
          error: error.message
        };
      }

      // 3. Restore the user preferences
      try {
        const userPreference = await preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, DEFAULT_CONFIG.allowPrerelease);
        autoUpdater.allowPrerelease = userPreference;
        autoUpdater.allowDowngrade = false; // Always restore to false
        console.log('[Updater] Restored user preference:', { allowPrerelease: userPreference, allowDowngrade: false });
      } catch (prefError) {
        console.warn('[Updater] Failed to restore user preference, using default:', prefError);
        autoUpdater.allowPrerelease = DEFAULT_CONFIG.allowPrerelease;
        autoUpdater.allowDowngrade = false; // Make sure it is restored in error cases too
      }

      console.log('[Updater] Unified version check completed:', {
        stable: results.stable?.hasUpdate ? results.stable.remoteVersion : 'no update',
        prerelease: results.prerelease?.hasUpdate ? results.prerelease.remoteVersion : 'no update'
      });

      return createSuccessResponse(results);
    } catch (error) {
      console.error('[Updater] Unified version check failed:', error);
      return createDetailedErrorResponse(error);
    } finally {
      // Release the lock whether it succeeds or fails
      isCheckingForUpdate = false;
      console.log('[Updater] Unified version check completed, lock released');
    }
  });

  // Start downloading the update
  ipcMain.handle(IPC_EVENTS.UPDATE_START_DOWNLOAD, async () => {
    // Check whether a download is already in progress
    if (isDownloadingUpdate) {
      console.log('[Updater] Download already in progress, ignoring request');
      return createSuccessResponse({
        message: 'Download already in progress',
        inProgress: true
      });
    }

    // Set the download state lock
    isDownloadingUpdate = true;

    try {
      console.log('[Updater] Starting update download...');
      await autoUpdater.downloadUpdate();
      return createSuccessResponse(null);
    } catch (error) {
      console.error('[Updater] Download failed:', error);
      isDownloadingUpdate = false; // Reset the state on failure
      return createDetailedErrorResponse(error);
    }
  });

  // Install the update
  ipcMain.handle(IPC_EVENTS.UPDATE_INSTALL, async () => {
    // Check whether an install is already in progress
    if (isInstallingUpdate) {
      console.log('[Updater] Install already in progress, ignoring request');
      return createSuccessResponse({
        message: 'Install already in progress',
        inProgress: true
      });
    }

    // Set the install state lock
    isInstallingUpdate = true;

    try {
      console.log('[Updater] ===== STARTING UPDATE INSTALLATION =====');
      console.log('[Updater] User clicked "Install and Restart"');
      console.log('[Updater] The application will now close and restart with the new version');
      console.log('[Updater] If the application does not restart automatically, please launch it manually');
      console.log('[Updater] ==========================================');
      
      // Set the exit-for-update-install flag to skip the data saving logic
      isUpdaterQuitting = true;
      console.log('[Updater] Set updater quit flag to skip data save');
      
      // Note: quitAndInstall exits the app immediately, so finally will not run
      // This method will:
      // 1. Close the current app
      // 2. Install the new version
      // 3. Launch the new version of the app
      autoUpdater.quitAndInstall();
      
      // This line is usually not reached, because quitAndInstall() exits the app immediately
      return createSuccessResponse({
        message: 'Installation started, application will restart'
      });
    } catch (error) {
      console.error('[Updater] Install failed:', error);
      console.error('[Updater] ===== INSTALLATION ERROR =====');
      console.error('[Updater] Error details:', error.message);
      console.error('[Updater] This may indicate:');
      console.error('[Updater] 1. Update file was corrupted during download');
      console.error('[Updater] 2. Insufficient permissions to install');
      console.error('[Updater] 3. Antivirus software blocked the installation');
      console.error('[Updater] 4. The update file was not properly downloaded');
      console.error('[Updater] Please try downloading the update again');
      console.error('[Updater] ===============================');
      
      return createDetailedErrorResponse(error);
    } finally {
      // Make sure the lock is always released (although it is not reached when quitAndInstall succeeds)
      isInstallingUpdate = false;
    }
  });

  // Get the ignored version state
  ipcMain.handle(IPC_EVENTS.UPDATE_GET_IGNORED_VERSIONS, async () => {
    try {
      const ignoredVersions = await getIgnoredVersions();
      console.log('[Updater] Retrieved ignored versions:', ignoredVersions);
      return createSuccessResponse(ignoredVersions);
    } catch (error) {
      console.error('[Updater] Failed to get ignored versions:', error);
      return createDetailedErrorResponse(error);
    }
  });

  // Ignore a version
  ipcMain.handle(IPC_EVENTS.UPDATE_IGNORE_VERSION, async (event, version, versionType) => {
    try {
      // Validate the version number format
      if (!validateVersion(version)) {
        throw new Error(`Invalid version format: ${version}`);
      }

      // If no type is specified, determine it automatically from the version number
      if (!versionType) {
        versionType = version.includes('-') ? 'prerelease' : 'stable';
      }

      console.log('[Updater] Ignoring version:', version, 'type:', versionType);

      // Get the current ignored version data
      const ignoredVersions = await getIgnoredVersions();

      // Update the ignored version of the corresponding type
      ignoredVersions[versionType] = version;

      // Save the updated data
      await preferenceService.set(PREFERENCE_KEYS.IGNORED_VERSIONS, ignoredVersions);

      return createSuccessResponse(null);
    } catch (error) {
      console.error('[Updater] Failed to ignore version:', error);
      return createDetailedErrorResponse(error);
    }
  });

  // Unignore a version
  ipcMain.handle(IPC_EVENTS.UPDATE_UNIGNORE_VERSION, async (event, versionType) => {
    try {
      // Validate the version type
      if (!['stable', 'prerelease'].includes(versionType)) {
        throw new Error(`Invalid version type: ${versionType}`);
      }

      console.log('[Updater] Unignoring version type:', versionType);

      // Get the current ignored version data
      const ignoredVersions = await getIgnoredVersions();

      // Clear the ignored version of the corresponding type
      ignoredVersions[versionType] = null;

      // Save the updated data
      await preferenceService.set(PREFERENCE_KEYS.IGNORED_VERSIONS, ignoredVersions);

      return createSuccessResponse(null);
    } catch (error) {
      console.error('[Updater] Failed to unignore version:', error);
      return createDetailedErrorResponse(error);
    }
  });

  // Download a specific version (atomic operation)
  ipcMain.handle(IPC_EVENTS.UPDATE_DOWNLOAD_SPECIFIC_VERSION, async (event, versionType) => {
    try {
      console.log('[Updater] Starting atomic download for version type:', versionType);

      // Validate the version type
      if (!['stable', 'prerelease'].includes(versionType)) {
        throw new Error(`Invalid version type: ${versionType}`);
      }

      // Prevent concurrent downloads - set the state lock immediately
      if (isDownloadingUpdate) {
        console.log('[Updater] Download already in progress');
        return createErrorResponse('Download already in progress');
      }

      // Set the download state immediately to prevent race conditions
      isDownloadingUpdate = true;

      // 1. Save the current config (including the preferences and the autoUpdater instance config)
      const originalPreference = await preferenceService.get(PREFERENCE_KEYS.ALLOW_PRERELEASE, false);
      const originalAutoUpdaterConfig = {
        allowPrerelease: autoUpdater.allowPrerelease,
        allowDowngrade: autoUpdater.allowDowngrade
      };
      console.log('[Updater] Original preference:', originalPreference);
      console.log('[Updater] Original autoUpdater config:', originalAutoUpdaterConfig);

      try {
        // 2. Set the target channel (modify both the preferences and the autoUpdater instance)
        const targetPreference = versionType === 'prerelease';
        await preferenceService.set(PREFERENCE_KEYS.ALLOW_PRERELEASE, targetPreference);

        // Configure the autoUpdater instance directly to make sure this operation uses the correct config
        autoUpdater.allowPrerelease = targetPreference;
        autoUpdater.allowDowngrade = true; // Allow downgrade, supporting a switch from the preview version to the stable version

        console.log('[Updater] Set preference to:', targetPreference);
        console.log('[Updater] Set autoUpdater config:', {
          allowPrerelease: autoUpdater.allowPrerelease,
          allowDowngrade: autoUpdater.allowDowngrade
        });

        // 3. Check for updates
        console.log('[Updater] Checking for updates...');
        const checkResult = await autoUpdater.checkForUpdates();

        if (!checkResult || !checkResult.updateInfo) {
          console.log('[Updater] No update available for', versionType);
          isDownloadingUpdate = false; // Reset the state
          return createSuccessResponse({
            hasUpdate: false,
            message: `No ${versionType} update available`,
            versionType,
            version: null,
            reason: 'no-update'
          });
        }

        // Check whether the version is ignored
        const isIgnored = await isVersionIgnored(checkResult.updateInfo.version);
        if (isIgnored) {
          console.log('[Updater] Version is ignored:', checkResult.updateInfo.version);
          isDownloadingUpdate = false; // Reset the state
          return createSuccessResponse({
            hasUpdate: false,
            message: `Version ${checkResult.updateInfo.version} is ignored`,
            versionType,
            version: checkResult.updateInfo.version,
            reason: 'ignored'
          });
        }

        // 4. Start downloading immediately
        console.log('[Updater] Starting download for version:', checkResult.updateInfo.version);
        // Note: isDownloadingUpdate was already set at the start of the function

        // Since autoDownload = false, downloadUpdate() must be called manually
        // Note: do not await downloadUpdate(), because it waits until the download completes
        // We only need to start the download and return immediately, avoiding timeout problems
        try {
          // Start the download (without waiting for completion)
          autoUpdater.downloadUpdate().catch(downloadError => {
            console.error('[Updater] Download failed:', downloadError);
            isDownloadingUpdate = false;
            // Send the error event to the frontend
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(IPC_EVENTS.UPDATE_ERROR, {
                message: downloadError.message || 'Download failed',
                error: downloadError,
                timestamp: new Date().toISOString()
              });
            }
          });
          console.log('[Updater] Download started successfully');

          // Send the download start event to the frontend immediately to keep the UI state in sync
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_EVENTS.UPDATE_DOWNLOAD_STARTED, {
              versionType,
              version: checkResult.updateInfo.version,
              timestamp: new Date().toISOString()
            });
          }
        } catch (downloadError) {
          console.error('[Updater] Failed to start download:', downloadError);
          isDownloadingUpdate = false;
          throw downloadError;
        }

        return createSuccessResponse({
          hasUpdate: true,
          updateInfo: checkResult.updateInfo,
          versionType,
          message: `Started downloading ${versionType} version ${checkResult.updateInfo.version}`
        });

      } finally {
        // 5. Make sure the original config is restored (the preferences and the autoUpdater instance)
        try {
          // Restore the preferences
          await preferenceService.set(PREFERENCE_KEYS.ALLOW_PRERELEASE, originalPreference);
          console.log('[Updater] Restored preference to:', originalPreference);

          // Restore the autoUpdater instance config
          autoUpdater.allowPrerelease = originalAutoUpdaterConfig.allowPrerelease;
          autoUpdater.allowDowngrade = originalAutoUpdaterConfig.allowDowngrade;
          console.log('[Updater] Restored autoUpdater config to:', originalAutoUpdaterConfig);
        } catch (restoreError) {
          console.error('[Updater] Failed to restore configuration:', restoreError);
        }
      }

    } catch (error) {
      console.error('[Updater] Atomic download failed:', error);
      // Make sure the download state is reset
      if (isDownloadingUpdate) {
        isDownloadingUpdate = false;
      }
      return createDetailedErrorResponse(error);
    }
  });

  console.log('[Main Process] Auto-update handlers ready.');
}
