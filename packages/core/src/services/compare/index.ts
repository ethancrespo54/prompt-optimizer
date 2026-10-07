export { CompareService } from './service';
export * from './types';
export * from './errors';

// Import the service class to create the singleton
import { CompareService } from './service';

// Create the singleton instance
export const compareService = new CompareService(); 