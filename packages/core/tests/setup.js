import { vi } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'
import { setupServer } from 'msw/node'
import { llmHandlers } from './utils/llm-mock-service.js'

// Load environment variables (from the project root directory)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const shouldMockLLM =
  process.env.VCR_MODE !== 'off' &&
  process.env.ENABLE_REAL_LLM !== 'true' &&
  process.env.RUN_REAL_API !== '1'

const mswServer = shouldMockLLM ? setupServer(...llmHandlers) : null

beforeAll(() => {
  if (!mswServer) return
  const onUnhandledRequest = process.env.VCR_MODE === 'replay' ? 'error' : 'bypass'
  mswServer.listen({ onUnhandledRequest })
})

afterEach(() => {
  mswServer?.resetHandlers()
})

afterAll(() => {
  mswServer?.close()
})

// Mock localStorage
const localStorageMock = {
  store: new Map(),
  getItem: vi.fn((key) => {
    return localStorageMock.store.get(key) || null;
  }),
  setItem: vi.fn((key, value) => {
    localStorageMock.store.set(key, value);
  }),
  removeItem: vi.fn((key) => {
    localStorageMock.store.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageMock.store.clear();
  })
};

// Inject localStorage globally
global.localStorage = localStorageMock;

// Reset the mock state before each test
beforeEach(() => {
  localStorageMock.store.clear();
  vi.clearAllMocks();
}); 
