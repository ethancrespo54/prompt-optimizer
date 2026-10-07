import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock the window object
const windowMock = {
  localStorage: {
    store: new Map(),
    getItem: vi.fn((key) => {
      return windowMock.localStorage.store.get(key) || null;
    }),
    setItem: vi.fn((key, value) => {
      windowMock.localStorage.store.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      windowMock.localStorage.store.delete(key);
    }),
    clear: vi.fn(() => {
      windowMock.localStorage.store.clear();
    })
  }
};

// Inject the window mock globally
Object.defineProperty(global, 'window', {
  value: windowMock,
  writable: true,
  configurable: true
});

// Inject localStorage globally
Object.defineProperty(global, 'localStorage', {
  value: windowMock.localStorage,
  writable: true,
  configurable: true
});

// Mock the Teleport component
config.global.stubs = {
  Teleport: {
    template: '<div><slot /></div>'
  }
}

// Reset the mock state before each test
beforeEach(() => {
  windowMock.localStorage.store.clear();
  vi.clearAllMocks();
}); 