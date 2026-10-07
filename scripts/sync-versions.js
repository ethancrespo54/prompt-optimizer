const fs = require('fs');
const path = require('path');

const rootPackage = require('../package.json');
const targetVersion = rootPackage.version;

console.log(`🔄 Starting to sync the version to ${targetVersion}`);

// List of files whose version needs syncing
const versionFiles = [
  {
    path: 'packages/extension/public/manifest.json',
    field: 'version',
    description: 'Browser extension manifest file'
  },
  {
    path: 'packages/desktop/package.json',
    field: 'version',
    description: 'Desktop app package file'
  }
  // More files that need syncing can be added in the future
];

let syncCount = 0;
let errorCount = 0;

versionFiles.forEach(file => {
  try {
    const filePath = path.resolve(__dirname, '..', file.path);
    
    // Check whether the file exists
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File does not exist: ${file.path}`);
      errorCount++;
      return;
    }
    
    // Read and update the file
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldVersion = content[file.field];
    
    if (oldVersion === targetVersion) {
      console.log(`✅ ${file.description}: ${file.path} version is already up to date (${targetVersion})`);
    } else {
      content[file.field] = targetVersion;
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
      console.log(`✅ ${file.description}: ${file.path} version updated ${oldVersion} → ${targetVersion}`);
      syncCount++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${file.path}:`, error.message);
    errorCount++;
  }
});

console.log(`\n📊 Sync complete: ${syncCount} files updated, ${errorCount} errors`);

if (errorCount > 0) {
  process.exit(1);
} 