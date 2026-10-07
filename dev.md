# Development Guide

## Table of Contents

- [Local Development Environment Setup](#local-development-environment-setup)
- [Docker Development and Deployment](#docker-development-and-deployment)
- [Environment Variable Configuration](#environment-variable-configuration)
- [Development Workflow](#development-workflow)
- [Project Build and Deployment](#project-build-and-deployment)
- [Common Problems and Solutions](#common-problems-and-solutions)

## Local Development Environment Setup

### Basic Environment Requirements
- Node.js >= 18
- pnpm >= 8
- Git >= 2.0
- VSCode (recommended)

### Development Environment Setup
```bash
# 1. Clone the project
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. Install dependencies
pnpm install

# 3. Start the development services
pnpm dev               # Web development: build core/ui and run the web app
pnpm dev:fresh         # Web development (full reset): clean + reinstall + start
pnpm dev:desktop       # Desktop development: build core/ui, run web and desktop together
pnpm dev:desktop:fresh # Desktop development (full reset): clean + reinstall + start
```

## Docker Development and Deployment

### Environment Requirements
- Docker >= 20.10.0

### Docker Build and Run

#### Basic Build
```bash
# Get the version number from package.json
$VERSION=$(node -p "require('./package.json').version")

# Build the image (using the dynamic version number)
docker build -t linshen/prompt-optimizer:$VERSION .

# Add the latest tag
docker tag linshen/prompt-optimizer:$VERSION linshen/prompt-optimizer:latest

# Run the container
docker run -d -p 80:80 --restart unless-stopped --name prompt-optimizer -e ACCESS_PASSWORD=1234!@#$  linshen/prompt-optimizer:$VERSION


# Push
docker push linshen/prompt-optimizer:$VERSION
docker push linshen/prompt-optimizer:latest

```

Local Docker build test
```shell
docker build -t linshen/prompt-optimizer:test .
docker rm -f prompt-optimizer
docker run -d -p 80:80 --restart unless-stopped --name prompt-optimizer -e VITE_GEMINI_API_KEY=111 linshen/prompt-optimizer:test

```


### Multi-Stage Build Notes

The Dockerfile uses a multi-stage build to optimize the image size:

1. `base`: Base Node.js environment with pnpm installed
2. `builder`: Build stage; installs dependencies and builds the project
3. `production`: Final image; contains only the build artifacts and nginx

## Environment Variable Configuration

### Local Development Environment Variables
Create a `.env.local` file in the project root directory:

```env
# OpenAI API configuration
VITE_OPENAI_API_KEY=your_openai_api_key

# Gemini API configuration
VITE_GEMINI_API_KEY=your_gemini_api_key

# DeepSeek API configuration
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key

# Custom API configuration
VITE_CUSTOM_API_KEY=your_custom_api_key
VITE_CUSTOM_API_BASE_URL=your_custom_api_base_url
VITE_CUSTOM_API_MODEL=your_custom_model_name
```

### Docker Environment Variables
Set container environment variables with the `-e` flag:

```bash
docker run -d -p 80:80 \
  -e VITE_OPENAI_API_KEY=your_key \
  -e VITE_CUSTOM_API_BASE_URL=your_api_url \
  prompt-optimizer
```

## Development Workflow

### Commit Conventions
```bash
# Commit format
<type>(<scope>): <subject>

# Examples
feat(ui): add a new prompt editor component
fix(core): fix API call timeout issue
```

### Testing Process
```bash
# Run the tests of all packages
pnpm test

# Run the tests of a specific package (use the pnpm workspace commands directly)
pnpm -F @prompt-optimizer/core test
pnpm -F @prompt-optimizer/ui test
pnpm -F @prompt-optimizer/web test
```

## Project Build and Deployment

### Branch Management Strategy

#### 🌿 Branch Structure
- **`main`**: Production branch; triggers automatic Vercel deployment
- **`develop`**: Development branch; does not trigger Vercel deployment
- **`feature/*`**: Feature branches, branched from develop

#### 🔄 Development Workflow
```bash
# 1. Start development from the develop branch
git checkout develop
git pull origin develop

# 2. Create a feature branch
git checkout -b feature/new-feature

# 3. Push to the feature branch when development is done
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 4. Merge into the develop branch (does not trigger Vercel deployment)
git checkout develop
git merge feature/new-feature
git push origin develop

# 5. When ready to release, merge into the main branch (triggers Vercel deployment)
git checkout main
git merge develop
git push origin main
```

### Version Release Process

#### 📋 Version Number Management
Use semantic versioning and manage version numbers with pnpm commands:

```bash
# Update the version number (without creating a tag)
pnpm version:prepare patch   # 1.0.0 → 1.0.1
pnpm version:prepare minor   # 1.0.0 → 1.1.0
pnpm version:prepare major   # 1.0.0 → 2.0.0

# Commit the version change
git commit -m "chore: bump version to $(node -p \"require('./package.json').version\")"
```

#### 🚀 Desktop App Release
The project has an automated release process based on Git tags, supporting multi-platform builds and automatic Release Notes generation.

**Releasing an official version**:
```bash
# 1. Prepare the version on the develop branch
git checkout develop
pnpm version:prepare minor
git commit -m "chore: bump version to $(node -p \"require('./package.json').version\")"
git push origin develop

# 2. Merge into the main branch (triggers Vercel deployment)
git checkout main
git merge develop
git push origin main

# 3. Create and push the version tag (triggers the Desktop build)
pnpm run version:tag
pnpm run version:publish
```

**Releasing a preview version**:
```bash
# Create a preview version tag on the develop branch
git checkout develop

# Manually create a preview version tag
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1

# Or use the scripts (first manually change the version number to a preview format)
# Edit package.json: "version": "1.2.0-beta.1"
# pnpm run version:tag && pnpm run version:publish
```

#### 📦 Automated Build Features
- **Multi-platform builds**: Automatically builds the installers on Windows, macOS, and Linux
- **Smart Release Notes**: Automatically extracts the commit messages between two versions
- **Version type detection**: Automatically distinguishes official versions from preview versions
- **Commit optimization**: Automatically truncates overly long commits (80 characters) and limits the number displayed (20)

#### 🎯 Release Result
After the tag is pushed, GitHub Actions will automatically:
1. Build the Desktop app on three platforms in parallel
2. Generate Release Notes containing the commit history
3. Create a GitHub Release and upload all build files
4. Mark official versions as Release and preview versions as Pre-release

### Build Notes
The project uses a monorepo architecture with the following sub-packages:
- `@prompt-optimizer/core`: Core logic package
- `@prompt-optimizer/ui`: UI component package
- `@prompt-optimizer/web`: Web application
- `@prompt-optimizer/extension`: Browser extension
- `@prompt-optimizer/desktop`: Desktop application

Build order: core → ui → (web/extension/desktop in parallel)

### Local Build
```bash
# Build all packages (in dependency order: core → ui → web/ext/desktop in parallel)
pnpm build

# Build a specific package
pnpm build:core        # Build the core package
pnpm build:ui          # Build the UI component package
pnpm build:web         # Build the web app
pnpm build:ext         # Build the browser extension
pnpm build:desktop     # Build the Desktop app (including packaging)

# Build the Desktop executables
pnpm build:desktop             # Full build: core→ui→web→desktop packaging
```

### Manual Release (Local Build)
If you need to build and test locally:

```bash
# Build for all platforms (only works on the corresponding platform)
pnpm build:desktop

# View the build results
ls packages/desktop/dist/
```

### Version Management Best Practices

#### 📋 Version Number Conventions
- **Official versions**: `v1.0.0`, `v2.1.3` - follow semantic versioning
- **Preview versions**: `v1.0.0-beta.1`, `v1.0.0-rc.1`, `v1.0.0-alpha.1`

#### ⚠️ electron-updater Version Number Notes

**Important**: electron-updater has special restrictions on how it handles pre-release versions, so the correct version number format must be used.

**✅ Recommended format (conforms to the SemVer 2.0.0 standard)**:
```bash
v1.2.6-alpha.1, v1.2.6-alpha.2, v1.2.6-alpha.3
v1.2.6-beta.1, v1.2.6-beta.2, v1.2.6-beta.3
v1.2.6-rc.1, v1.2.6-rc.2, v1.2.6-rc.3
```

**❌ Formats to avoid (may cause electron-updater detection problems)**:
```bash
v1.2.6-alpha1, v1.2.6-alpha2, v1.2.6-alpha3
v1.2.6-beta1, v1.2.6-beta2, v1.2.6-beta3
v1.2.6-rc1, v1.2.6-rc2, v1.2.6-rc3
```

**Explanation**:
- electron-updater treats the first part of a pre-release version (such as `beta` in `beta2`) as the **channel identifier**
- When using the `beta1`, `beta2`, `beta3` format, version detection anomalies may occur
- An update from `v1.2.6-beta2` to `v1.2.6-beta3` cannot be detected correctly
- Using the dot-separated format `beta.1`, `beta.2`, `beta.3` avoids this problem

**Best practices**:
1. Always use the dot-separated pre-release version format
2. Follow the `<version>-<stage>.<number>` naming convention
3. If you run into version detection problems, consider skipping the problematic version or republishing

#### 🔄 Complete Release Process
1. **Development stage**: Develop new features on the `develop` branch
2. **Version preparation**: Use `pnpm version:prepare` on the `develop` branch to update the version number
3. **Preview testing**: Create a `beta` tag on the `develop` branch for testing
4. **Production deployment**: Merge into the `main` branch to trigger the Vercel deployment
5. **Official release**: Create the official version tag on the `main` branch

#### 🐛 Bug Fixes and Version Overwriting

**How to handle a bug once it is found**:

**Option 1: Overwrite the existing version (not recommended for official versions)**
```bash
# 1. Fix the bug and commit
git add .
git commit -m "fix: fix critical bug"

# 2. Delete the local and remote tags
git tag -d v1.2.0                    # Delete the local tag
git push origin :refs/tags/v1.2.0    # Delete the remote tag

# 3. Manually delete the GitHub Release
# Go to GitHub → Releases → find the corresponding version → Delete

# 4. Recreate the tag and release
pnpm run version:tag      # Recreate the tag
pnpm run version:publish  # Push the tag again (triggers a new build)
```

**Option 2: Release a patch version (recommended)**
```bash
# 1. Fix the bug
git add .
git commit -m "fix: fix critical bug"

# 2. Release a patch version
pnpm version:prepare patch  # 1.2.0 → 1.2.1
git commit -m "chore: bump version to v1.2.1"
pnpm run version:tag
pnpm run version:publish
```

**Overwriting a preview version (relatively safe)**
```bash
# A preview version can be safely overwritten
git tag -d v1.2.0-beta.1
git push origin :refs/tags/v1.2.0-beta.1

# Republish after the fix
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

#### ⚠️ Important Notes
- **Avoid using `pnpm version` directly**: It creates a tag automatically, which may cause an accidental release
- **Use `pnpm version:prepare`**: It only updates the version number and does not create a tag
- **Control when the tag is created manually**: Use `pnpm run version:tag` and `pnpm run version:publish`
- **Be careful when overwriting official versions**: It may affect users who have already downloaded them
- **Patch versions are recommended**: Instead of overwriting an existing version
- **Vercel deployment**: Only pushes to the `main` branch trigger it
- **Desktop release**: Pushing a Git tag triggers the Desktop app build

#### 📝 Commit Conventions
To generate better Release Notes, use a standardized commit format:
```bash
# Adding a feature
git commit -m "feat(ui): add a new prompt editor"

# Fixing an issue
git commit -m "fix(core): fix API call timeout issue"

# Documentation update
git commit -m "docs: update development guide"

# Performance optimization
git commit -m "perf(web): improve page load speed"
```

### Vercel Deployment Control

#### 🎯 Branch Control Strategy
The project uses branch-based Vercel deployment control, which is simple and effective.

**Deployment rules**:
- ✅ **`main/master` branch**: Automatically triggers Vercel deployment
- ❌ **Other branches**: Do not trigger Vercel deployment

#### 📝 Manually Controlling Builds

**Skip the Vercel build**:
```bash
# Use the standard Git skip marker
git commit -m "docs: update documentation [skip ci]"
git commit -m "fix(desktop): fix desktop app issue [skip ci]"
```

**Normal Vercel build**:
```bash
# Pushing to the main branch triggers the build automatically
git checkout main
git merge develop
git push origin main
```

#### 🔧 Best Practices
- **Development stage**: Work on the `develop` branch; it does not trigger Vercel deployment
- **Testing stage**: Publish preview versions on the `develop` branch to test the Desktop app
- **Production deployment**: Vercel deployment is only triggered when merging into the `main` branch

### Common Docker Commands

```bash
# View container logs
docker logs -f prompt-optimizer

# Enter the container
docker exec -it prompt-optimizer sh

# Container management
docker stop prompt-optimizer
docker start prompt-optimizer
docker restart prompt-optimizer

# Clean up resources
docker rm prompt-optimizer
docker rmi prompt-optimizer
```

## Release Troubleshooting

### 🚨 Emergency Fix Process

#### Scenario 1: An official version has a serious bug
```bash
# 1. Fix the bug immediately
git checkout main
git pull origin main
# ... fix the code ...
git add .
git commit -m "hotfix: fix serious bug"

# 2. Release the hotfix version
pnpm version:prepare patch  # 1.2.0 → 1.2.1
git commit -m "chore: hotfix version v1.2.1"
git push origin main

# 3. Release the new version
pnpm run version:tag
pnpm run version:publish

# 4. Mark the old version as "not recommended" in the GitHub Release
```

#### Scenario 2: A preview version needs fast iteration
```bash
# Delete the existing preview version
git tag -d v1.2.0-beta.1
git push origin :refs/tags/v1.2.0-beta.1

# Republish the same version after the fix
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

#### Scenario 3: The build failed and needs to be re-triggered
```bash
# Delete the tag to re-trigger the build
git push origin :refs/tags/v1.2.0
git push origin v1.2.0

# Or create a new patch version
pnpm version:prepare patch
pnpm run version:tag
pnpm run version:publish
```

### 📋 GitHub Release Management

#### Deleting a Release
1. Go to the GitHub project page
2. Click the "Releases" tab
3. Find the version to delete
4. Click "Edit" → "Delete this release"
5. Confirm the deletion

#### Editing a Release
1. Click "Edit" on the Release page
2. You can change the title and description, or mark it as a pre-release
3. You can delete or re-upload build files
4. Save the changes

### ⚡ Quick Command Reference

```bash
# Delete the local tag
git tag -d v1.2.0

# Delete the remote tag
git push origin :refs/tags/v1.2.0

# List all tags
git tag -l

# List the remote tags
git ls-remote --tags origin

# Force-push a tag (overwrites the remote)
git push origin v1.2.0 --force

# Recreate and push a tag
git tag v1.2.0
git push origin v1.2.0
```

## Common Problems and Solutions

### Dependency Installation Problems
```bash
# Clear the dependency cache
pnpm clean

# Reinstall dependencies
pnpm install --force
```

### Development Environment Problems
```bash
# Fully reset the Web development environment
pnpm dev:fresh

# Fully reset the Desktop development environment
pnpm dev:desktop:fresh

# Clear the build cache
pnpm clean
rm -rf node_modules
pnpm install
```

### Handling Build Failures
1. Check that the Node.js version meets the requirements
2. Clear the build cache: `pnpm clean`
3. Reinstall dependencies: `pnpm install`
4. View the detailed build log: `pnpm build --debug`

### Container Runtime Problems
1. Check port usage: `netstat -ano | findstr :80`
2. Check the container logs: `docker logs prompt-optimizer`
3. Check the container status: `docker ps -a`
