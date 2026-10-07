# MCP Server User Guide

Prompt Optimizer supports the Model Context Protocol (MCP) and can be integrated with MCP-enabled AI applications such as Claude Desktop.

## 🎯 Features

- **optimize-user-prompt**: Optimize user prompts to improve LLM performance
- **optimize-system-prompt**: Optimize system prompts to improve LLM performance
- **iterate-prompt**: Iteratively improve a mature prompt based on specific requirements

## 🚀 Quick Start

### Docker Deployment (Recommended)

Docker is the simplest way to deploy; the web UI and the MCP server start together:

```bash
# Basic deployment
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer

# Access URLs
# Web UI: http://localhost:8081
# MCP server: http://localhost:8081/mcp
```

### Local Deployment for Developers

> **Note**: This method is only for developers doing development and debugging. Regular users should use Docker deployment.

```bash
# 1. Clone the project
git clone https://github.com/your-repo/prompt-optimizer.git
cd prompt-optimizer

# 2. Install dependencies
pnpm install

# 3. Configure environment variables (copy and edit .env.local)
cp env.local.example .env.local

# 4. Start the MCP server
pnpm mcp:dev
```

The server will start at `http://localhost:3000/mcp`. Developers can see the [Developer Documentation](../../packages/mcp-server/README.md) for more development-related information.

## ⚙️ Environment Variable Configuration

### API Key Configuration

At least one API key must be configured:

```bash
# Choose one or more API keys
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_DEEPSEEK_API_KEY=your-deepseek-key
VITE_SILICONFLOW_API_KEY=your-siliconflow-key
VITE_ZHIPU_API_KEY=your-zhipu-key

# Custom API (such as Ollama)
VITE_CUSTOM_API_KEY=your-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=qwen2.5:0.5b
```

### MCP Server Configuration

```bash
# Preferred model provider (when multiple API keys are configured)
# Options: openai, gemini, anthropic, deepseek, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
MCP_DEFAULT_MODEL_PROVIDER=openai

# Log level (optional, default debug)
# Options: debug, info, warn, error
MCP_LOG_LEVEL=info

# HTTP port (optional, default 3000; not needed for Docker deployment)
MCP_HTTP_PORT=3000

# Default language (optional, default zh)
# Options: zh, en
MCP_DEFAULT_LANGUAGE=zh
```

## 🔗 Client Connection

### Claude Desktop Integration

#### 1. Find the Configuration Directory

- **Windows**: `%APPDATA%\Claude\services`
- **macOS**: `~/Library/Application Support/Claude/services`
- **Linux**: `~/.config/Claude/services`

#### 2. Edit the Configuration File

Create or edit the `services.json` file:

```json
{
  "services": [
    {
      "name": "Prompt Optimizer",
      "url": "http://localhost:8081/mcp"
    }
  ]
}
```

> **Note**: If you are using the local developer deployment (port 3000), change the URL to `http://localhost:3000/mcp`.



### Other MCP Clients

The MCP server supports the standard MCP protocol and can be used by any compatible client:

- **Connection URL**:
  - Docker deployment: `http://localhost:8081/mcp`
  - Local deployment: `http://localhost:3000/mcp`
- **Protocol**: HTTP Streamable
- **Transport**: HTTP or stdio

## 🧪 Testing and Verification

### Using MCP Inspector

MCP Inspector is the official testing tool:

```bash
# 1. Start the MCP server
pnpm mcp:dev

# 2. Start Inspector in another terminal
npx @modelcontextprotocol/inspector
```

In the Inspector web UI:
1. Select the transport: `Streamable HTTP`
2. Server URL: `http://localhost:3000/mcp`
3. Click "Connect" to connect to the server
4. Test the available tools

## 🔧 Troubleshooting

### Common Issues

#### 1. Server Fails to Start

**Error**: `Error: listen EADDRINUSE: address already in use`
**Solution**: The port is in use. Change the port or stop the process occupying it

```bash
# Check port usage
netstat -ano | findstr :3000

# Change the port
MCP_HTTP_PORT=3001 pnpm mcp:dev
```

#### 2. Invalid API Key

**Error**: `No enabled models found`
**Solution**: Check the API key configuration

```bash
# Make sure at least one valid API key is configured
echo $VITE_OPENAI_API_KEY
```

#### 3. Model Provider Mismatch

**Error**: The wrong model is used
**Solution**: Check the `MCP_DEFAULT_MODEL_PROVIDER` setting

```bash
# Make sure the provider name is correct
MCP_DEFAULT_MODEL_PROVIDER=openai  # not OpenAI
```

#### 4. 401 Authentication Error with Docker Deployment

**Problem**: After deploying with Docker and enabling `ACCESS_PASSWORD`, MCP Inspector fails to connect and returns a 401 error

**Cause**: When password protection is enabled in a Docker deployment, Nginx enables Basic authentication for all routes, including the `/mcp` route

**Solution**:
- **Fixed (v1.4.0+)**: the `/mcp` route is now configured to bypass Basic authentication
- **Temporary workarounds for older versions**:
  1. Do not set the `ACCESS_PASSWORD` environment variable
  2. Or use network isolation (for example, use it only on an internal network)
  3. Or expose port 3000 directly: `docker run -p 3000:3000 ...`

**Technical notes**:
- The MCP protocol itself does not support HTTP Basic authentication
- Newer versions add `auth_basic off;` for the `/mcp` route in `docker/nginx.conf`
- Access to the web app is still password-protected

#### 5. Claude Desktop Connection Failure

**Steps to resolve**:
1. Confirm the MCP server is running
2. Check that the URL is correct
3. Check your firewall settings
4. Check the Claude Desktop logs

### Log Debugging

Enable verbose logging:

```bash
# Development environment
MCP_LOG_LEVEL=debug pnpm mcp:dev

# Docker environment
docker run -e MCP_LOG_LEVEL=debug ...
```

## 📚 More Resources

- [MCP Official Documentation](https://modelcontextprotocol.io)
- [Developer Documentation](../../packages/mcp-server/README.md)
- [Project Home](../../README.md)

## 🆘 Getting Help

If you run into problems:

1. Read the troubleshooting section of this document
2. Check the project Issues
3. Submit a new Issue describing the problem
4. Contact the development team
