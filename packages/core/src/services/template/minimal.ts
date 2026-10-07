/**
 * Unified template approach
 * Uses Mustache as the unified template engine; all environments (including browser extensions) use the same syntax
 */

import Mustache from 'mustache';

// Export Mustache and let users decide how to use it
export { Mustache };

// Provide convenience functions
export const render = Mustache.render.bind(Mustache); 