/**
 * IPC serialization utilities
 * Handles the serialization problem of Vue reactive objects in Electron IPC communication
 * 
 * This utility is designed specifically for ElectronProxy classes and provides unified serialization handling
 */

import { CORE_ERROR_CODES, type ErrorParams } from '../constants/error-codes'

class IpcSerializationError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(details: string) {
    super(`[${CORE_ERROR_CODES.IPC_SERIALIZATION_FAILED}] ${details}`)
    this.name = 'IpcSerializationError'
    this.code = CORE_ERROR_CODES.IPC_SERIALIZATION_FAILED
    this.params = { details }
  }
}

/**
 * Safe serialization function used to clean Vue reactive objects
 * Ensures that all objects passed over IPC are plain JavaScript objects
 * 
 * @param obj Object to serialize
 * @returns Plain JavaScript object
 */
export function safeSerializeForIPC<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitive types are returned directly
  if (typeof obj !== 'object') {
    return obj;
  }

  // Use JSON serialization to ensure 100% IPC compatibility
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('[IPC Serialization] Failed to serialize object:', error);
    const details = error instanceof Error ? error.message : String(error)
    throw new IpcSerializationError(`Failed to serialize object for IPC: ${details}`);
  }
}

/**
 * Check whether an object can be safely passed over IPC
 * Mainly used for debugging during development
 * 
 * @param obj Object to check
 * @param label Object label, used for log output
 */
export function debugIPCSerializability(obj: any, label: string = 'object'): void {
  try {
    JSON.stringify(obj);
    console.log(`[IPC Debug] ${label} is serializable`);
  } catch (error) {
    console.error(`[IPC Debug] ${label} is NOT serializable:`, error);
    console.error(`[IPC Debug] Object:`, obj);
  }
}

/**
 * Serialize multiple parameters in batch
 * Used for scenarios with multiple parameters that need serialization
 * 
 * @param args Parameter array
 * @returns Serialized parameter array
 */
export function safeSerializeArgs<T extends any[]>(...args: T): T {
  return args.map(arg => safeSerializeForIPC(arg)) as T;
}
