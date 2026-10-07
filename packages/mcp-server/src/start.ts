#!/usr/bin/env node

/**
 * MCP Server start file
 * This file is dedicated to starting the server, avoiding execution at build time
 */

import { main } from './index.js';

// Start the server
main().catch(console.error);
