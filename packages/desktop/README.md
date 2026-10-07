# Desktop App Environment Variable Configuration Guide

## Environment Variable Loading Order

The desktop app loads environment variables in the following order:

1. **`.env.local` in the project root** (recommended) - consistent with the test environment
2. **`.env` in the desktop app directory** - desktop-app-specific configuration
3. **System environment variables** - manually set environment variables

## Recommended Configuration Methods

### Method 1: Use .env.local in the project root (recommended)

Add the following to the `prompt-optimizer/.env.local` file in the project root:

```bash
# OpenAI
VITE_OPENAI_API_KEY=your_openai_key_here

# Google Gemini
VITE_GEMINI_API_KEY=your_gemini_key_here

# DeepSeek
VITE_DEEPSEEK_API_KEY=your_deepseek_key_here

# SiliconFlow
VITE_SILICONFLOW_API_KEY=your_siliconflow_key_here

# Zhipu AI
VITE_ZHIPU_API_KEY=your_zhipu_key_here

# Custom API
VITE_CUSTOM_API_KEY=your_custom_key_here
VITE_CUSTOM_API_BASE_URL=your_custom_base_url
VITE_CUSTOM_API_MODEL=your_custom_model
```

**Advantages**:
- Shares the same configuration with the web version and the test environment
- Only one configuration file to maintain
- Automatically excluded by `.gitignore`, so keys are not leaked

### Method 2: Desktop-app-specific configuration

Add the same environment variables to the `packages/desktop/.env` file.

**Advantages**:
- Independent configuration for the desktop app
- Can use different API keys from the web version

### Method 3: System environment variables

Windows users:
```cmd
set VITE_OPENAI_API_KEY=your_openai_key_here
set VITE_GEMINI_API_KEY=your_gemini_key_here
npm start
```

macOS/Linux users:
```bash
export VITE_OPENAI_API_KEY=your_openai_key_here
export VITE_GEMINI_API_KEY=your_gemini_key_here
npm start
```

## Verifying the Configuration

When the desktop app starts, the main process console shows:

```
[Main Process] .env.local file loaded from project root
[Main Process] .env file loaded from desktop directory
[Main Process] Checking environment variables...
[Main Process] Found VITE_OPENAI_API_KEY: sk-1234567...
[Main Process] Found VITE_GEMINI_API_KEY: AIzaSyA...
```

If you see `Missing VITE_XXX_API_KEY`, the corresponding environment variable is not set.

## FAQ

### Q: Is my .env.local file effective?
A: **Yes!** The desktop app now automatically loads the `.env.local` file in the project root.

### Q: Why does the UI show an API key, but the connection test fails?
A: This is because the UI process and the main process have isolated environments. Make sure that:
1. The environment variables are set correctly in the `.env.local` file
2. Restart the desktop app to reload the environment variables
3. Check the main process console to confirm the environment variables are read correctly

### Q: Can I use multiple configuration methods at the same time?
A: Yes. dotenv merges the configurations in loading order; variables loaded later do not override variables that already exist.

## Security Reminders

- Never commit files containing API keys to the Git repository
- `.env.local` is already excluded in `.gitignore`
- If you use a `.env` file, add it to `.gitignore` manually