export interface IStorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clearAll(): Promise<void>;
  
  // Hidden advanced methods - automatically choose the best implementation internally
  updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void>;
  batchUpdate(operations: Array<{
    key: string;
    operation: 'set' | 'remove';
    value?: string;
  }>): Promise<void>;
  
  // Optional: storage capability query (for monitoring and debugging)
  getCapabilities?(): {
    supportsAtomic: boolean;
    supportsBatch: boolean;
    maxStorageSize?: number;
  };
}
