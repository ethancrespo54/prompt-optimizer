# Prompt Optimizer MCP Server

An MCP (Model Context Protocol) server for the Prompt Optimizer project. It provides prompt optimization tools, supports connections over the HTTP protocol, and can be used by any MCP-compatible client.

> **User deployment and usage guide**: See the [MCP Server User Guide](../../docs/user/mcp-server.md)

## Features

- **optimize-user-prompt**: Optimize user prompts to improve LLM performance
- **optimize-system-prompt**: Optimize system prompts to improve LLM performance
- **iterate-prompt**: Iteratively improve a mature prompt based on specific requirements

## Quick Start

### Development Mode (Recommended)

```bash
# Install dependencies
pnpm install

# Development mode: automatically watches file changes, recompiles, and restarts the server
pnpm dev
```

The server starts at `http://localhost:3000/mcp` and restarts automatically after code changes.

### Production Mode

```bash
# 1. Build the project
pnpm build

# 2. Start the server
pnpm start
```

The server starts at `http://localhost:3000/mcp`.

### Root Directory Shortcut Commands

If you are in the project root directory, you can use the following shortcut commands:

```bash
# Development mode
pnpm mcp:dev

# Build the project
pnpm mcp:build

# Start the server (debug logging is enabled by default)
pnpm mcp:start

# To adjust the log level
MCP_LOG_LEVEL=info pnpm mcp:start

# Run tests
pnpm mcp:test
```

## Development Configuration

### Environment Variables

For development you need to configure a `.env.local` file in the project root directory. For detailed configuration instructions, see the [User Guide](../../docs/user/mcp-server.md#environment-variable-configuration).

Minimal development environment configuration example:
```bash
# Configure at least one API key
VITE_OPENAI_API_KEY=your-openai-key
MCP_DEFAULT_MODEL_PROVIDER=openai
MCP_LOG_LEVEL=debug
```

## Logging Configuration

The MCP server enables `debug` level logging by default. You can adjust it with the `MCP_LOG_LEVEL` environment variable:

```bash
# Default debug level (shows all logs)
pnpm start

# Switch to info level
MCP_LOG_LEVEL=info pnpm start

# Switch to warn level
MCP_LOG_LEVEL=warn pnpm start

# Switch to error level
MCP_LOG_LEVEL=error pnpm start
```

### Log Level Reference

- `debug` - Debug information (default, used during development)
- `info` - General information (service startup, configuration, etc.)
- `warn` - Warning messages (non-fatal issues)
- `error` - Error messages (issues that need attention)



## Development

```bash
# Development mode (automatically watches file changes and restarts the server)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Testing and Debugging

### Testing with MCP Inspector

MCP Inspector is the official visual testing tool and supports testing MCP servers through a Web UI.

#### Testing with MCP Inspector

```bash
# 1. Start the MCP server
pnpm start

# 2. Start the Inspector in another terminal
npx @modelcontextprotocol/inspector
```

Then in the Inspector Web UI:
1. Select the transport: `Streamable HTTP`
2. Server URL: `http://localhost:3000/mcp`
3. Click "Connect" to connect to the server
4. Test the available tools: `optimize-user-prompt`, `optimize-system-prompt`, `iterate-prompt`

#### Other Testing Methods

**Important**: The MCP protocol is not a simple REST API and cannot be tested directly with curl.

**Recommended testing methods**:
1. **MCP Inspector** (official tool) - the best choice
2. **Claude Desktop** - real-world usage scenario
3. **Custom MCP client** - using `@modelcontextprotocol/sdk`

**Why curl cannot be used**:
- MCP uses the JSON-RPC 2.0 protocol
- It requires a special handshake and initialization process
- HTTP transport uses a streaming connection, not a simple request-response

## 📚 Related Documentation

- [MCP Server User Guide](../../docs/user/mcp-server.md) - User deployment and usage guide
- [MCP Server Development Experience](../../docs/archives/120-mcp-server-module/experience.md) - Development experience and best practices
- [Project Home](../../README.md) - Project overview and quick start

## Architecture

This MCP server follows a zero-intrusion design principle:
- Uses only the existing Core module APIs, with no modifications required
- Uses in-memory storage for stateless operation
- Provides parameter adaptation between MCP and Core formats

## License

GNU Affero General Public License v3.0 (AGPL-3.0-only)
