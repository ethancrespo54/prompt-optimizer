# Desktop App Environment Variable Configuration Guide

## Overview
This document explains how to configure the build-time and runtime behavior of the desktop app through environment variables.

## 🔧 Build-Time Configuration (electron-builder)

### Auto-Update Repository Configuration

#### Production Build
- Uses the configuration in `package.json` by default: `linshenkx/prompt-optimizer`
- The GitHub workflow automatically detects the current repository and updates the configuration
- Supports automatic builds for forked repositories (no extra configuration needed)
- Uses `GH_TOKEN_FOR_UPDATER` to publish to GitHub Releases

#### Development Environment Testing
To test the auto-update feature during local development:

1. **Edit `dev-app-update.yml`**:
   ```yaml
   provider: github
   owner: your-username
   repo: your-repo-name
   private: false  # or true (for a private repository)
   ```

2. **Set environment variables** (if you need to access Releases of a private repository):
   ```bash
   export GITHUB_TOKEN=your_github_token
   ```

3. **Start development mode**:
   ```bash
   pnpm run dev
   ```

### Configuration Notes
- `package.json`: Production build configuration
- `dev-app-update.yml`: Development environment test configuration
- `autoUpdater.forceDevUpdateConfig = true` is already configured in `main.js`

### GitHub Token Notes
- **Production**: Uses `GH_TOKEN_FOR_UPDATER` (must be configured in GitHub Secrets)
- **Purpose**: Only used to publish to GitHub Releases; only public repositories are supported

## ⚡ Runtime Configuration (App Startup)

### API Key Configuration
The following environment variables must be set when the app starts:

```bash
# OpenAI
export VITE_OPENAI_API_KEY=your_openai_key

# Other AI services
export VITE_GEMINI_API_KEY=your_gemini_key
export VITE_DEEPSEEK_API_KEY=your_deepseek_key
export VITE_SILICONFLOW_API_KEY=your_siliconflow_key
export VITE_ZHIPU_API_KEY=your_zhipu_key

# Custom API
export VITE_CUSTOM_API_KEY=your_custom_key
export VITE_CUSTOM_API_BASE_URL=https://api.example.com
export VITE_CUSTOM_API_MODEL=custom-model-name
```

### Dynamic Update Source Configuration
The app supports switching the update source dynamically at runtime:

```bash
# GitHub repository configuration
export GITHUB_REPOSITORY=owner/repo
# Or set them separately
export DEV_REPO_OWNER=owner
export DEV_REPO_NAME=repo

# GitHub Token (required for private repositories)
export GH_TOKEN=your_github_token
export GITHUB_TOKEN=your_github_token  # Fallback
```

## 🎯 Practical Usage Examples

### Scenario 1: A developer forks the project
```bash
# 1. Set the build-time configuration
export REPO_OWNER=myusername
export REPO_NAME=my-prompt-optimizer
export REPO_PRIVATE=false

# 2. Build the app
pnpm run build

# 3. Set the runtime configuration
export GITHUB_REPOSITORY=myusername/my-prompt-optimizer
export VITE_OPENAI_API_KEY=sk-...

# 4. Run the app
./dist/PromptOptimizer-1.2.0-win-x64.exe
```

### Scenario 2: Deploying a custom public repository
```bash
# 1. Set the build-time configuration
export REPO_OWNER=company
export REPO_NAME=public-prompt-optimizer

# 2. Build the app
pnpm run build

# 3. Set the runtime configuration
export GITHUB_REPOSITORY=company/public-prompt-optimizer
export VITE_OPENAI_API_KEY=sk-...

# 4. Run the app
./dist/PromptOptimizer-1.2.0-win-x64.exe
```

## 🔍 Configuration Verification

### Build-Time Verification
After the build completes, check the generated `app-update.yml` file:
```yaml
# It should contain the correct repository information
provider: github
owner: your-username
repo: your-repo-name
private: false
```

### Runtime Verification
After starting the app, check the console log:
```
[Updater] Using custom repository configuration: {
  owner: 'your-username',
  repo: 'your-repo-name',
  private: false,
  source: 'environment variables'
}
```

## ⚠️ Notes

1. **Build time vs. runtime**:
   - `REPO_*` variables affect the generation of `app-update.yml` at build time
   - `GITHUB_*` variables affect the dynamic configuration at runtime

2. **Priority**:
   - Runtime configuration takes precedence over build-time configuration
   - Environment variables take precedence over default values

3. **Repository requirements**:
   - Only public repositories are supported
   - Private repositories are not supported

4. **Compatibility**:
   - If no environment variables are set, the default `linshenkx/prompt-optimizer` is used
   - Backward compatible with the existing build process

## 🐛 Troubleshooting

### Build-Time Issues
- Make sure the environment variables are set before building
- Check the contents of the `app-update.yml` file
- Verify that the repository name format is correct

### Runtime Issues
- Check the app startup logs
- Confirm the repository exists and is public
- Verify that the repository name format is correct

---

**Last updated**: 2025-01-12  
**Version**: v1.2.0+