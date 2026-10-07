import type { IHistoryManager, PromptRecord, PromptRecordChain } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { HistoryStorageError, RecordNotFoundError } from './errors';

/**
 * History manager proxy for the Electron environment
 * Communicates with the real HistoryManager in the main process over IPC
 */
export class ElectronHistoryManagerProxy implements IHistoryManager {
  private get electronAPI() {
    if (!window.electronAPI) {
      throw new HistoryStorageError('Electron API not available', 'storage');
    }
    return window.electronAPI;
  }

  async addRecord(record: PromptRecord): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.addRecord(safeRecord);
  }

  async getRecords(): Promise<PromptRecord[]> {
    return this.electronAPI.history.getHistory();
  }

  async getRecord(id: string): Promise<PromptRecord> {
    const records = await this.getRecords();
    const record = records.find(r => r.id === id);
    if (!record) {
      throw new RecordNotFoundError(`Record with ID ${id} not found`, id);
    }
    return record;
  }

  async deleteRecord(id: string): Promise<void> {
    return this.electronAPI.history.deleteRecord(id);
  }

  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return this.electronAPI.history.getIterationChain(recordId);
  }

  async clearHistory(): Promise<void> {
    return this.electronAPI.history.clearHistory();
  }

  async getAllChains(): Promise<PromptRecordChain[]> {
    return this.electronAPI.history.getAllChains();
  }

  async getChain(chainId: string): Promise<PromptRecordChain> {
    return this.electronAPI.history.getChain(chainId);
  }

  async createNewChain(record: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.createNewChain(safeRecord);
  }

  async addIteration(params: {
    chainId: string;
    originalPrompt: string;
    optimizedPrompt: string;
    iterationNote?: string;
    modelKey: string;
    templateId: string;
  }): Promise<PromptRecordChain> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeParams = safeSerializeForIPC(params);
    return this.electronAPI.history.addIteration(safeParams);
  }

  async deleteChain(chainId: string): Promise<void> {
    return this.electronAPI.history.deleteChain(chainId);
  }

  // Implement the IImportExportable interface

  /**
   * Export all history records
   */
  async exportData(): Promise<PromptRecord[]> {
    return (this.electronAPI as any).history.exportData();
  }

  /**
   * Import history records
   */
  async importData(data: any): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).history.importData(safeData);
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    return (this.electronAPI as any).history.getDataType();
  }

  /**
   * Validate the history record data format
   */
  async validateData(data: any): Promise<boolean> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).history.validateData(safeData);
  }
}
