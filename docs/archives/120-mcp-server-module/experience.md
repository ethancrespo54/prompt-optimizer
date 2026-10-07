# MCP Server Module Development Lessons Learned

## 🎯 Core Lessons

### Zero-intrusion Design Principle
When developing the MCP Server module, we adopted a zero-intrusion design principle: no Core module code is modified at all, and functionality is integrated through an adapter layer. This design brings the following benefits:

1. **Keeps the architecture clean**: avoids modifying the core module and keeps its code pure
2. **Lowers maintenance cost**: updates to the core module do not affect the MCP Server module
3. **Improves testability**: the MCP Server module and the Core module can be tested independently

**Implementation points**:
- **Never modify Core module code**: all adaptation is done in the MCP server layer
- **Use existing interfaces**: call strictly according to the Core module's existing API
- **Complete service initialization**: all Core service dependencies must be initialized

### The Core Module's Service Architecture Matches Well
The Core module's service-oriented architecture closely matches the MCP protocol, which provides a good foundation for the zero-intrusion design:
- All core functionality is exposed through service interfaces
- Dependencies between services are clear, making them easy for the adapter layer to manage
- Parameter and return value formats are well specified, making protocol conversion easy

### Layered Architecture Design
Using a layered architecture that separates the MCP protocol layer, the transport layer and the service adapter layer gives each layer clear responsibilities and makes maintenance and extension easy.

## 🛠️ Technical Implementation Lessons

### Environment Variable Loading Timing Problem
In Node.js applications, the timing of environment variable loading is very important. The problem we ran into was that the Core module initializes its configuration when it is imported, at which point the environment variables have not been loaded yet.

**Symptoms**:
- Node.js environment variables must be loaded before modules are imported, otherwise they cannot be read during module initialization
- The Core module reads environment variables to initialize its configuration as soon as it is imported

**Solution**:
1. Use Node.js's `-r` flag to preload environment variables before the module system initializes
2. Create a preload script (preload-env.js) that supports multi-path lookup to suit different deployment scenarios
3. Keep configuration in the project root directory for easier management
4. Support silent loading to avoid errors when the configuration file cannot be found

**Implementation details**:
```bash
node -r ./preload-env.js dist/index.js
```

### Build-time Side Effect Control
When using the tsup build tool, pay attention to side effects in the entry file.

**Symptoms**:
- Build tools (such as tsup) executing module-level code cause the server to start unexpectedly
- The port is occupied during the build, hurting the development experience

**Best practices**:
1. The entry file only exports and does not execute any code with side effects
2. Use a separate startup file to run the main logic
3. Avoid calling functions with side effects at module top level
4. Separate the build entry from the startup entry

### Windows Process Management Compatibility
When developing on Windows, pay attention to process management quirks.

**Symptoms**:
- Process management tools such as concurrently have signal handling problems on Windows
- Ctrl+C cannot terminate child processes correctly
- Complex process management leads to a poor development experience

**Solution**:
1. Avoid complex process management tools such as concurrently
2. Separate the build and startup flows and use simple npm scripts
3. Use simple npm scripts instead of complex command combinations
4. Prefer simple solutions on Windows

### MCP Protocol Debugging Tips
Debugging is an important part of developing an MCP Server.

**Debugging tools**:
1. **MCP Inspector**: use the official debugging tool for protocol-level testing
2. **Layered testing strategy**: test the Core services first and then the MCP wrapper, to locate problems quickly
3. **Log-driven debugging**: log the state of every step in detail to locate problems quickly

**Testing methods**:
- Use a custom MCP Inspector test tool to verify functionality
- Test with Chinese and English input to ensure internationalization support
- Test with custom parameters to verify that parameter adaptation is correct

## 🚫 Pitfall Guide

### Environment Variable Loading Timing Trap
**Problem**: Environment variables are loaded after the modules are imported, so configuration cannot be initialized correctly
**Cause**: The Node.js module system executes module code at import time, when environment variables may not be loaded yet
**Solution**: Use Node.js's `-r` flag to preload the environment variable script
**How to avoid**: Handle environment variable loading uniformly in the project startup script

### Build-time Side Effect Trap
**Problem**: Server startup code was unexpectedly executed during the build, occupying the port
**Cause**: Build tools execute module-level code to analyze dependencies
**Solution**: Separate the build entry from the startup entry to make sure the build has no side effects
**How to avoid**: The entry file only exports and performs no operations with side effects

### Windows Signal Handling Trap
**Problem**: Tools such as concurrently have signal handling problems on Windows and cannot terminate processes correctly
**Cause**: Windows' signal handling mechanism differs from Unix systems
**Solution**: Avoid complex process management tools and use simple npm scripts
**How to avoid**: Prefer simple solutions on Windows

### Storage Layer Environment Difference Trap
**Problem**: Storage layer configuration is inconsistent across environments
**Cause**: The storage mechanisms of the browser and Node.js environments differ
**Solution**: Use StorageFactory to adapt to different environments and choose the correct Provider when configuring
**How to avoid**: Settle the storage strategy early in the project to avoid large-scale changes later

## 🔄 Architecture Design Lessons

### Deep Application of the Adapter Pattern
In the MCP Server module we used the adapter pattern extensively to convert the MCP protocol's interfaces into the Core module's interfaces. The advantages of this design pattern include:

1. **Decoupling**: the MCP protocol layer is completely decoupled from the Core service layer
2. **Extensibility**: new adapters can easily be added to support more functionality
3. **Maintainability**: each adapter has a single responsibility, which makes maintenance easy

**Implementation complexity considerations**:
- **Service management**: the complete Core service stack must be managed
- **Parameter conversion**: simple MCP parameters → complex Core parameter formats
- **Configuration management**: configuration and validation of default models and templates
- **Error handling**: converting Core errors → MCP protocol errors

### The Value of a Stateless Design
The MCP Server uses a stateless design with in-memory storage and no persistence, so every restart starts from a fresh state. The advantages of this design:

1. **Simplified deployment**: no need to consider data persistence and state management
2. **Improved reliability**: avoids state inconsistency problems
3. **Easy to test**: every test runs in a fresh environment
4. **Fits its positioning as a professional tool**: matches the usage pattern of tool-type applications

### Independent Module Design Principle
Keep dependencies clean and avoid circular dependencies:
- Depend only on the Core module and avoid UI layer pollution
- Organize layers by function for easy maintenance and extension
- A unified error conversion layer provides a consistent user experience

## 📚 Learning Resources and Tool Configuration

### Useful Documentation
- **MCP official documentation**: https://modelcontextprotocol.io - protocol specification and best practices
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk - complete API documentation and examples

### Development Tool Configuration
- **MCP TypeScript SDK**: uses the registerTool/registerResource methods and supports Zod validation
- **tsup build tool**: configured for ESM/CJS dual-format output, consistent with the Core module
- **Environment variable preloading**: create the preload-env.js script, supporting multi-path lookup and silent loading

### Code Implementation Patterns
- **MCP Tools implementation pattern**: use registerTool + Zod validation
- **Storage layer adaptation**: StorageFactory.create('memory') - in-memory storage configuration
- **Parameter adaptation pattern**: converting simple MCP parameters → complex Core parameters

## 🎯 Key Decision Records

### Technology Selection Decisions
- **MCP SDK**: chose the official TypeScript SDK, because of type safety and complete feature support
- **Storage solution**: chose MemoryStorageProvider, because it suits tool-type applications with no persistence requirement
- **Transport**: supports both stdio + HTTP, for flexible deployment that meets different usage scenarios
- **Validation library**: chose Zod, because the project already uses it and it matches the MCP SDK perfectly

### Architecture Decisions
- **Dependencies**: depend only on the Core module, to keep the architecture clean and avoid UI layer pollution
- **Module structure**: organized by functional layers, for easy maintenance and extension
- **Error handling**: a unified error conversion layer, to provide a consistent user experience
- **Zero-intrusion principle**: do not modify any Core code, to keep the core module pure
