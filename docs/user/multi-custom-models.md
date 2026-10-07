# Multiple Custom Models Configuration Guide

## Overview

Prompt Optimizer now supports configuring an unlimited number of custom models, so you can use multiple local models or self-hosted API services at the same time.

## Features

- ✅ Supports an unlimited number of custom models
- ✅ Automatic discovery and registration through environment variables
- ✅ Friendly model name display
- ✅ Fully backward compatible with the original configuration
- ✅ Supports all deployment methods (Web, Desktop, Docker, MCP)

## Configuration

### Environment Variable Format

Use the following format to configure multiple custom models:

```bash
VITE_CUSTOM_API_KEY_<suffix>=your-api-key          # Required
VITE_CUSTOM_API_BASE_URL_<suffix>=your-base-url    # Required
VITE_CUSTOM_API_MODEL_<suffix>=your-model-name     # Required
```

### Requirements

- **Suffix**: may only contain letters (a-z, A-Z), digits (0-9), underscores (_), and hyphens (-), and must be no longer than 50 characters
- **API_KEY**: required, used for API authentication
- **BASE_URL**: required, the API server address
- **MODEL**: required, the specific model name

### Suffix Naming Examples

| Model Service | Recommended Suffix | Environment Variable Example | Display Name |
|---------|-----------|-------------|----------|
| Qwen3 | `qwen3` | `VITE_CUSTOM_API_KEY_qwen3` | Qwen3 |
| Qwen2.5 | `qwen2_5` or `qwen25` | `VITE_CUSTOM_API_KEY_qwen2_5` | Qwen2 5 |
| Local Claude | `claude_local` | `VITE_CUSTOM_API_KEY_claude_local` | Claude Local |
| Local GPT | `gpt_local` | `VITE_CUSTOM_API_KEY_gpt_local` | Gpt Local |
| Custom LLM | `my_llm` | `VITE_CUSTOM_API_KEY_my_llm` | My Llm |
| Company internal model | `company_ai` | `VITE_CUSTOM_API_KEY_company_ai` | Company Ai |

**Naming rules:**
- ✅ **Allowed**: letters (a-z, A-Z), digits (0-9), underscores (_), hyphens (-)
- ❌ **Not allowed**: dots (.), spaces, special symbols, etc.
- 💡 **Recommendation**: use lowercase letters and separate words with underscores (e.g. `qwen2_5`, `claude_local`)
- 📏 **Length limit**: at most 50 characters

### Restrictions

- **Character restriction**: the suffix may only contain `a-z A-Z 0-9 _ -`; dots, spaces, and other special characters are not supported
- **Length restriction**: at most 50 characters
- **Conflict check**: must not conflict with existing static model names (e.g. openai, gemini, deepseek, zhipu, siliconflow, custom)
- **Completeness requirement**: all three settings must be provided; if any one is missing, the model is skipped

### Configuration Example

```bash
# Original configuration (kept for compatibility)
VITE_CUSTOM_API_KEY=default-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=default-model

# Ollama Qwen3 model
VITE_CUSTOM_API_KEY_qwen3=ollama-qwen3-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b

# Ollama Qwen2.5 model (use an underscore to separate the version number)
VITE_CUSTOM_API_KEY_qwen2_5=ollama-qwen25-key
VITE_CUSTOM_API_BASE_URL_qwen2_5=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen2_5=qwen2.5:14b

# Local Claude-compatible service
VITE_CUSTOM_API_KEY_claude_local=claude-local-key
VITE_CUSTOM_API_BASE_URL_claude_local=http://localhost:8080/v1
VITE_CUSTOM_API_MODEL_claude_local=claude-3-sonnet

# Other self-hosted API service
VITE_CUSTOM_API_KEY_my_llm=my-llm-api-key
VITE_CUSTOM_API_BASE_URL_my_llm=https://my-api.example.com/v1
VITE_CUSTOM_API_MODEL_my_llm=my-custom-model
```

## UI Display

Configured models appear in the model selection dropdown as:

- **Custom** (original configuration)
- **Qwen3** (from custom_qwen3)
- **Qwen2 5** (from custom_qwen2_5)
- **Claude Local** (from custom_claude_local)
- **My Llm** (from custom_my_llm)

The suffix is automatically formatted into a friendly display name:
- Underscores and hyphens are replaced with spaces
- The first letter of each word is capitalized automatically
- For example: `qwen2_5` → `Qwen2 5`, `claude_local` → `Claude Local`

## Deployment Configuration

### Web Development Environment

Add the configuration to the `.env.local` file in the project root:

```bash
VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
```

### Desktop Application

Set system environment variables or specify them at launch:

```bash
# Windows
set VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
npm run desktop

# macOS/Linux
export VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
npm run desktop
```

### Docker Deployment

#### Option 1: Environment Variable Parameters

```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e VITE_CUSTOM_API_KEY_ollama=dummy-key \
  -e VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1 \
  -e VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b \
  -e VITE_CUSTOM_API_KEY_qwen3=your-qwen3-key \
  -e VITE_CUSTOM_API_BASE_URL_qwen3=http://host.docker.internal:11434/v1 \
  -e VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### Option 2: Environment Variable File

Create a `.env` file:

```bash
VITE_OPENAI_API_KEY=your-openai-key
VITE_CUSTOM_API_KEY_ollama=dummy-key
VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b
VITE_CUSTOM_API_KEY_qwen3=your-qwen3-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
```

Run with the environment variable file:

```bash
docker run -d -p 8081:80 --env-file .env \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### Option 3: Docker Compose

Modify `docker-compose.yml` to add the `env_file` setting:

```yaml
services:
  prompt-optimizer:
    image: linshen/prompt-optimizer:latest
    env_file:
      - .env  # Read environment variables from the .env file
    ports:
      - "8081:80"
    restart: unless-stopped
```

Then configure the variables in the `.env` file (same as Option 2).

### MCP Server

The MCP server automatically recognizes all configured custom models. You can specify the preferred model with `MCP_DEFAULT_MODEL_PROVIDER`:

```bash
# Use a specific custom model
MCP_DEFAULT_MODEL_PROVIDER=custom_qwen3
```

## FAQ

### Q: How do I verify that the configuration is correct?

A: After starting the app, check the console logs. Successfully configured models produce messages like:
```
[scanCustomModelEnvVars] Found 2 custom models: qwen3, claude_local
[generateDynamicModels] Generated model: custom_qwen3 (Qwen3)
```

### Q: What happens when the configuration is wrong?

A: The system prints detailed error messages but does not affect the normal use of other models:
```
[scanCustomModelEnvVars] Skipping invalid_suffix due to validation errors:
  - Invalid suffix format: invalid$suffix
```

### Q: How many custom models can I configure?

A: In theory there is no limit, but configure a reasonable number based on your actual needs to avoid an overcrowded UI.

### Q: How do I remove a custom model I no longer need?

A: Delete the corresponding environment variables and restart the app.

## Technical Details

- Model key format: `custom_<suffix>`
- Configuration validation: automatically checks the suffix format, API key, baseURL, etc.
- Fault tolerance: an error in a single configuration does not affect other models
- Defaults: reasonable default configuration is provided to ensure system stability

## Changelog

- **v1.2.6**: Code quality fixes and performance optimization
  - Fixed the MCP Server case conversion bug; environment variable mapping is now more accurate
  - Optimized configuration validation logic, improving performance by 66%
  - Resolved the ValidationResult interface conflict, improving type safety
  - Implemented dynamic retrieval of static model keys, with automatic synchronized updates
  - All fixes were fully tested to ensure consistency across environments

- **v1.4.0**: Added multiple custom models support
  - Fully backward compatible with the original configuration
  - Supports all deployment methods
  - Added configuration validation and fault tolerance
