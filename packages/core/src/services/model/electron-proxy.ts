import { IModelManager, TextModelConfig } from './types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { ModelError } from './errors';
import { MODEL_ERROR_CODES } from '../../constants/error-codes';

/**
 * ModelManager proxy for the Electron environment
 * Calls the real ModelManager instance in the main process over IPC
 */
export class ElectronModelManagerProxy implements IModelManager {
  private electronAPI: any;

  constructor() {
    // Validate the Electron environment
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      throw new ModelError(
        MODEL_ERROR_CODES.CONFIG_ERROR,
        'ElectronModelManagerProxy can only be used in Electron renderer process',
      );
    }
    this.electronAPI = (window as any).electronAPI;
  }

  async ensureInitialized(): Promise<void> {
    // In proxy mode, initialization is handled by the main process; this is just an empty implementation
    // But we could add an IPC call to trigger ensureInitialized in the main process
    await this.electronAPI.model.ensureInitialized();
  }

  async isInitialized(): Promise<boolean> {
    return this.electronAPI.model.isInitialized();
  }



  async getAllModels(): Promise<TextModelConfig[]> {
    return this.electronAPI.model.getAllModels();
  }

  async getModel(key: string): Promise<TextModelConfig | undefined> {
    const models = await this.getAllModels();
    return models.find(m => m.id === key);
  }

  async addModel(key: string, config: TextModelConfig): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeConfig = safeSerializeForIPC(config);
    await this.electronAPI.model.addModel({ key, ...safeConfig });
  }

  async updateModel(key: string, config: Partial<TextModelConfig>): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeConfig = safeSerializeForIPC(config);
    await this.electronAPI.model.updateModel(key, safeConfig);
  }

  async deleteModel(key: string): Promise<void> {
    await this.electronAPI.model.deleteModel(key);
  }

  async enableModel(key: string): Promise<void> {
    await this.updateModel(key, { enabled: true });
  }

  async disableModel(key: string): Promise<void> {
    await this.updateModel(key, { enabled: false });
  }

  async getEnabledModels(): Promise<TextModelConfig[]> {
    return this.electronAPI.model.getEnabledModels();
  }

  // Implement the IImportExportable interface

  /**
   * Export all model configs
   */
  async exportData(): Promise<TextModelConfig[]> {
    return (this.electronAPI as any).model.exportData();
  }

  /**
   * Import model configs
   */
  async importData(data: any): Promise<void> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).model.importData(safeData);
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    return (this.electronAPI as any).model.getDataType();
  }

  /**
   * Validate the model data format
   */
  async validateData(data: any): Promise<boolean> {
    // Serialize automatically to prevent errors when Vue reactive objects are passed over IPC
    const safeData = safeSerializeForIPC(data);
    return (this.electronAPI as any).model.validateData(safeData);
  }
}
