// Preload environment variables script
// This script is preloaded via the -r flag when Node.js starts
// Makes sure the environment variables are loaded into process.env before any module is imported

// Use ESM syntax
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname (must be built manually in ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const paths = [
  // 1. The current working directory
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  
  // 2. The project root directory (one level up from the mcp-server directory)
  resolve(process.cwd(), '../.env.local'),
  resolve(process.cwd(), '../.env'),
  
  // 3. Search upward from the mcp-server directory
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../../.env')
];

// Load the environment variables silently
paths.forEach(path => {
  try {
    config({ path });
  } catch (error) {
    // Ignore errors when the file does not exist
  }
});

console.log('Environment variables loaded for MCP server');
