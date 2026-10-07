import type { OptimizationMode } from '../prompt/types';

/**
 * Prompt record type
 */
export type PromptRecordType =
  | 'optimize'
  | 'userOptimize'
  | 'iterate'
  | 'test'
  | 'contextUserOptimize'
  | 'contextIterate'
  | 'imageOptimize'
  | 'contextImageOptimize'
  | 'imageIterate'
  | 'text2imageOptimize'
  | 'image2imageOptimize'
  | 'conversationMessageOptimize';

/**
 * Prompt record interface
 */
export interface PromptRecord {
  /** Record ID */
  id: string;
  /** Original prompt */
  originalPrompt: string;
  /** Optimized/iterated prompt */
  optimizedPrompt: string;
  /** Record type */
  type: PromptRecordType;
  /** ID of the prompt chain it belongs to */
  chainId: string;
  /** Version number within the chain */
  version: number;
  /** Previous version ID */
  previousId?: string;
  /** Timestamp */
  timestamp: number;
  /** Model key used */
  modelKey: string;
  /** 
   * Display name of the model used
   * Obtained from modelManager via modelKey, used for UI display
   * When not stored, modelKey is used as the fallback display
   */
  modelName?: string;
  /** ID of the prompt used */
  templateId: string;
  /** Modification note during iteration */
  iterationNote?: string;
  /** Metadata */
  metadata?: {
    optimizationMode?: OptimizationMode;  // Optimization mode
    messageId?: string;                   // ID of the message being optimized
    messageRole?: string;                 // Message role
    conversationSnapshot?: Array<{        // Conversation snapshot (used for multi-turn conversation optimization)
      id: string;                         // Message ID
      role: string;                       // Message role
      content: string;                    // Message content
      originalContent?: string;           // Original content
      chainId?: string;                   // 🆕 ID of the optimization chain used by this message
      appliedVersion?: number;            // 🆕 Applied version number (0=v0 original, 1=v1, 2=v2...)
    }>;
    [key: string]: any;                   // Keep extensibility
  };
}

/**
 * History record chain type
 */
export interface PromptRecordChain {
  chainId: string;
  rootRecord: PromptRecord;
  currentRecord: PromptRecord;
  versions: PromptRecord[];
}

import { IImportExportable } from '../../interfaces/import-export';

/**
 * History manager interface
 */
export interface IHistoryManager extends IImportExportable {
  /** Add a record */
  addRecord(record: PromptRecord): Promise<void>;
  /** Get all records */
  getRecords(): Promise<PromptRecord[]>;
  /** Get a specific record */
  getRecord(id: string): Promise<PromptRecord>;
  /** Delete a record */
  deleteRecord(id: string): Promise<void>;
  /** Get the iteration chain */
  getIterationChain(recordId: string): Promise<PromptRecord[]>;
  /** Clear all records */
  clearHistory(): Promise<void>;
  /** Get all record chains */
  getAllChains(): Promise<PromptRecordChain[]>;
  /** Get a specific chain */
  getChain(chainId: string): Promise<PromptRecordChain>;
  /** Create a new record chain */
  createNewChain(params: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain>;
  /** Add an iteration to an existing chain */
  addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    modelKey: string;
    templateId: string;
    iterationNote?: string;
    metadata?: Record<string, any>;
  }): Promise<PromptRecordChain>;
  /** Delete the record chain with the given ID */
  deleteChain(chainId: string): Promise<void>;
} 
