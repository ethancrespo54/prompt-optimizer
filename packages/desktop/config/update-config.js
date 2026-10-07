/**
 * Auto-update config
 * Manages the update-related config in one place, avoiding hard-coding
 */

// Import the static constants
const { IPC_EVENTS, PREFERENCE_KEYS, DEFAULT_CONFIG } = require('./constants');

// Read the repository info from package.json
const packageJson = require('../package.json');

// Get the repository info from the environment variables or package.json
const getRepositoryInfo = () => {
  // Prefer the environment variables
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return { owner, repo };
  }
  
  // Get it from the repository field of package.json
  if (packageJson.repository && packageJson.repository.url) {
    const repoUrl = packageJson.repository.url;
    const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  
  // Get it from the build.publish config
  if (packageJson.build && packageJson.build.publish) {
    const { owner, repo } = packageJson.build.publish;
    if (owner && repo) {
      return { owner, repo };
    }
  }
  
  // The last fallback (this should be avoided)
  console.warn('[Update Config] No repository info found, using fallback');
  return { owner: 'unknown', repo: 'unknown' };
};

// Validate the version number format
const validateVersion = (version) => {
  if (!version || typeof version !== 'string') {
    return false;
  }
  
  // Basic version number format validation (supports semantic versions)
  const versionRegex = /^v?\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
  return versionRegex.test(version);
};

// Build a safe Release URL
const buildReleaseUrl = (version) => {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const { owner, repo } = getRepositoryInfo();
  
  if (owner === 'unknown' || repo === 'unknown') {
    throw new Error('Repository information not available');
  }
  
  // Make sure the version number starts with v
  const versionTag = version.startsWith('v') ? version : `v${version}`;
  
  // Use the URL constructor to ensure safety
  const baseUrl = 'https://github.com';
  return `${baseUrl}/${owner}/${repo}/releases/tag/${encodeURIComponent(versionTag)}`;
};

// Note: the static constants have moved to the constants.js file
// Only the dynamic logic functions are kept here

module.exports = {
  // Dynamic functions
  getRepositoryInfo,
  validateVersion,
  buildReleaseUrl,

  // Re-export the static constants (keeping backward compatibility)
  IPC_EVENTS,
  PREFERENCE_KEYS,
  DEFAULT_CONFIG
};
