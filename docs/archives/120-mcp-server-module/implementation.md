# MCP Server Module Technical Implementation Details

## 🔧 Architecture Design

### Overall Architecture
The MCP Server module uses a layered architecture design that keeps it decoupled from the Core module:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │    │   MCP Client    │    │   MCP Client    │
│ (Claude Desktop)│    │ (MCP Inspector) │    │   (Custom App)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │ MCP Protocol
          ┌────────────────────────────────────────────────┐
          │              MCP Server                        │
          │  ┌─────────────────────────────────────────┐   │
          │  │           Transport Layer               │   │
          │  │  ┌─────────────┐  ┌─────────────────┐   │   │
          │  │  │    stdio    │  │ Streamable HTTP │   │   │
          │  │  └─────────────┘  └─────────────────┘   │   │
          │  └─────────────────────────────────────────┘   │
          │  ┌─────────────────────────────────────────┐   │
          │  │           MCP Protocol Layer            │   │
          │  │            ┌─────────┐                  │   │
          │  │            │  Tools  │                  │   │
          │  │            └─────────┘                  │   │
          │  └─────────────────────────────────────────┘   │
          │  ┌─────────────────────────────────────────┐   │
          │  │         Service Adapter Layer           │   │
          │  └─────────────────────────────────────────┘   │
          └────────────────────┬───────────────────────────┘
                               │
          ┌────────────────────────────────────────────────┐
          │              Core Module                       │
          │  ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
          │  │PromptService│ │ LLMService  │ │ Template │  │
          │  └─────────────┘ └─────────────┘ │ Manager  │  │
          │  ┌─────────────┐ ┌─────────────┐ └──────────┘  │
          │  │HistoryMgr   │ │ ModelMgr    │ ┌──────────┐  │
          │  └─────────────┘ └─────────────┘ │ Memory   │  │
          │                                  │ Storage  │  │
          │                                  └──────────┘  │
          └────────────────────────────────────────────────┘
```

### Module Structure
```
packages/mcp-server/
├── package.json                 # project configuration and dependencies
├── tsconfig.json               # TypeScript configuration
├── src/
│   ├── index.ts                # main entry point (exports only)
│   ├── start.ts                # startup entry point
│   ├── config/                 # configuration management
│   │   ├── environment.ts      # environment variable management
│   │   ├── models.ts           # default model configuration
│   │   └── templates.ts        # default template configuration
│   ├── tools/                  # MCP Tools implementation
│   │   ├── index.ts            # Tools exports
│   │   ├── optimize-user-prompt.ts      # user prompt optimization
│   │   ├── optimize-system-prompt.ts    # system prompt optimization
│   │   └── iterate-prompt.ts            # iterative prompt optimization
│   ├── adapters/               # service adapter layer
│   │   ├── core-services.ts    # Core service initialization and management
│   │   ├── parameter-adapter.ts # parameter format conversion
│   │   └── error-handler.ts    # error handling adapter
│   └── utils/                  # utility functions
│       └── logging.ts          # logging utility
├── examples/                   # usage examples
│   ├── stdio-client.js         # stdio client example
│   └── http-client.js          # HTTP client example
├── docs/                       # documentation
│   └── README.md               # usage instructions
└── tests/                      # test files
    ├── tools.test.ts           # Tools tests
    └── integration.test.ts     # integration tests
```

## 🐛 Problem Diagnosis and Resolution

### Environment Variable Loading Timing Problem
**Problem description**: The Core package's `defaultModels` is initialized when the module is imported, so it cannot read environment variables that are loaded later through dotenv.

**Solution**: Create a preload script (`preload-env.js`) that preloads environment variables when Node.js starts:

```javascript
// preload-env.js
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables by priority
const paths = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../.env.local'),
  resolve(__dirname, '../../.env.local'),
  // ... more paths
];

paths.forEach(path => {
  try {
    config({ path });
  } catch (error) {
    // Ignore file-not-found errors
  }
});
```

Preload with the `-r` flag:
```json
{
  "scripts": {
    "dev": "node -r ./preload-env.js dist/start.js --transport=http"
  }
}
```

### Background Process Spawned During the Build
**Problem description**: There is code at the end of the `src/index.ts` file that runs immediately, which would unexpectedly start the server and occupy the port when `tsup` builds.

**Solution**: File separation strategy

1. `src/index.ts` - only exports functions, does not execute:
```typescript
// Export the main function for external callers
export { main };
```

2. `src/start.ts` - dedicated to startup:
```typescript
#!/usr/bin/env node
import { main } from './index.js';

// Start the server
main().catch(console.error);
```

3. Update the build configuration:
```json
{
  "scripts": {
    "build": "tsup src/index.ts src/start.ts --format cjs,esm --dts --clean",
    "dev": "node -r ./preload-env.js dist/start.js --transport=http"
  }
}
```

## 📝 Implementation Steps

1. Project structure design and initialization
2. Core service manager implementation
3. Parameter adapter layer implementation
4. Default configuration management
5. MCP Tools implementation
6. Error handling and conversion
7. MCP Server instance creation
8. Multi-transport support
9. Testing and documentation

## 🔍 Debugging Process

During development, we used the following debugging methods:

1. **MCP Inspector debugging**: use the official debugging tool for protocol-level testing
2. **Log-driven debugging**: log the state of every step in detail to locate problems quickly
3. **Layered testing strategy**: test the Core services first and then the MCP wrapper, to locate problems quickly

## 🧪 Test Verification

### Build Tests
- ✅ CJS/ESM dual-format output
- ✅ TypeScript type definition generation
- ✅ No side effects during the build (the server is not started)

### Functional Tests
- ✅ Environment variables load correctly
- ✅ Automatic model selection and configuration
- ✅ Template loading and management
- ✅ MCP tool registration and invocation
- ✅ HTTP/stdio dual transport support

### Compatibility Tests
- ✅ Windows 10/11
- ✅ Node.js 18+
- ✅ MCP Inspector integration
- ✅ Claude Desktop compatibility
