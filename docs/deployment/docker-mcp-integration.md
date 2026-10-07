# MCP Server Integration in Docker

## Overview

The Docker container now runs two services at the same time:
1. **Web application** (Nginx) - port 80
2. **MCP server** (Node.js) - port 3000

Supervisor manages the multiple processes to keep the services running reliably.

## Architecture Diagram

```
Docker container
├── Nginx (port 80)
│   ├── Web application (/)
│   └── MCP proxy (/mcp -> localhost:3000)
├── MCP server (port 3000)
└── Supervisor (process management)
```

## Port Mapping

- **8081:80** - Web application access port
- **3000:3000** - Direct MCP server access port (optional)

## Environment Variable Configuration

### Web Application Configuration
```bash
VITE_OPENAI_API_KEY=sk-your-key
VITE_GEMINI_API_KEY=your-key
# ... other Web application API configuration
```

### MCP Server Configuration
```bash
# Basic configuration
MCP_HTTP_PORT=3000
MCP_LOG_LEVEL=info
MCP_ENABLE_CORS=true
MCP_ALLOWED_ORIGINS=*

# Model configuration (required)
MCP_DEFAULT_MODEL_PROVIDER=openai
MCP_DEFAULT_MODEL_NAME=gpt-4
MCP_DEFAULT_MODEL_API_KEY=sk-your-key
MCP_DEFAULT_MODEL_BASE_URL=
```

## Usage

### 1. Configure environment variables
```bash
cp .env.docker.example .env
# Edit the .env file and fill in your actual API keys
```

### 2. Start the services
```bash
docker-compose up -d
```

### 3. Access the services
- **Web application**: http://localhost:8081
- **MCP server**: 
  - Direct access: http://localhost:3000
  - Via proxy: http://localhost:8081/mcp

### 4. Health checks
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# View MCP server logs
docker-compose exec prompt-optimizer supervisorctl tail -f mcp-server
```

## MCP Server API

### Get the tool list
```bash
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

### Call a tool
```bash
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "optimize-user-prompt",
      "arguments": {
        "prompt": "Write a story",
        "template": "user-prompt-basic"
      }
    }
  }'
```

## Troubleshooting

### Check service status
```bash
docker-compose exec prompt-optimizer supervisorctl status
```

### Restart the MCP server
```bash
docker-compose exec prompt-optimizer supervisorctl restart mcp-server
```

### View detailed logs
```bash
# Nginx logs
docker-compose exec prompt-optimizer tail -f /var/log/nginx/error.log

# MCP server logs
docker-compose exec prompt-optimizer tail -f /var/log/supervisor/mcp-server.out.log
```

## Development Mode

To run in development mode, you can modify docker-compose.yml:

```yaml
services:
  prompt-optimizer:
    build:
      context: .
      dockerfile: Dockerfile
    # ... other configuration
```

Then rebuild:
```bash
docker-compose up --build -d
```
