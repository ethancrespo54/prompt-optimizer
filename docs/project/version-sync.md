# Version Sync Mechanism

## Overview

To keep the version numbers of all components in the project consistent, we have established an automatic version sync mechanism. It automatically syncs the version number in the root `package.json` to the other files that need a version number.

## Automatically Synced Files

The files whose version numbers are currently synced automatically include:

- `packages/extension/public/manifest.json` - Browser extension manifest file

## Usage

### Method 1: Use the pnpm version command (recommended)

Use the standard pnpm version management commands, and the version number is synced automatically:

```bash
# Bump the patch version (1.0.7 -> 1.0.8)
pnpm version patch

# Bump the minor version (1.0.7 -> 1.1.0)
pnpm version minor

# Bump the major version (1.0.7 -> 2.0.0)
pnpm version major
```

### Method 2: Manual sync

If you edit the version number in `package.json` directly, you can run the sync command manually:

```bash
pnpm run version:sync
```

## How It Works

1. **pnpm version command**: Updates the version number in `package.json`
2. **version hook**: Runs the sync script and stages the changes before the commit is created
   - Runs `pnpm run version:sync` to sync the version number in other files
   - Runs `git add -A` to add all changes to the staging area
3. **Sync script**: `scripts/sync-versions.js` reads the new version number and updates the other files
4. **git commit**: pnpm creates a commit and tag containing all version number changes

## Adding New Files to Sync

To add version sync for more files, edit the `versionFiles` array in `scripts/sync-versions.js`:

```javascript
const versionFiles = [
  {
    path: 'packages/extension/public/manifest.json',
    field: 'version',
    description: 'Browser extension manifest file'
  },
  {
    path: 'path/to/your/file.json',
    field: 'version',
    description: 'Description of your file'
  }
];
```

## Notes

- Make sure the target file is valid JSON
- The version field must exist in the target file
- The script exits and displays an error message when an error occurs
- All version number changes are logged to the console

## Troubleshooting

If the sync fails, check:

1. Whether the target file exists and is correctly formatted
2. Whether the version field exists in the target file
3. Whether there are file permission issues
4. Whether the Node.js version is compatible

If there are problems, you can run the sync script directly to debug:

```bash
node scripts/sync-versions.js
```
