import { IHistoryManager } from '../history/types';
import { IModelManager } from '../model/types';
import { ITemplateManager } from '../template/types';
import { IPreferenceService } from '../preference/types';
import { ContextRepo } from '../context/types';
import {
  DataExportFailedError,
  DataImportPartialFailedError,
  DataInvalidFormatError,
  DataInvalidJsonError,
} from './errors';
import { toErrorWithCode } from '../../utils/error';

/**
 * Data import/export manager
 *
 * Uses the coordinator pattern:
 * - DataManager is only responsible for coordinating import/export across services
 * - Each service is responsible for its own concrete import/export implementation
 * - The IImportExportable interface unifies the import/export behavior of all services
 */

// Legacy-version compatibility is now handled by each service itself

/**
 * Data manager interface
 */
export interface IDataManager {
  /**
   * Export all data
   * @returns Data string in JSON format
   */
  exportAllData(): Promise<string>;

  /**
   * Import all data
   * @param dataString Data string in JSON format
   */
  importAllData(dataString: string): Promise<void>;
}

export class DataManager implements IDataManager {
  private modelManager: IModelManager;
  private templateManager: ITemplateManager;
  private historyManager: IHistoryManager;
  private preferenceService: IPreferenceService;
  private contextRepo: ContextRepo;

  constructor(
    modelManager: IModelManager,
    templateManager: ITemplateManager,
    historyManager: IHistoryManager,
    preferenceService: IPreferenceService,
    contextRepo: ContextRepo
  ) {
    this.modelManager = modelManager;
    this.templateManager = templateManager;
    this.historyManager = historyManager;
    this.preferenceService = preferenceService;
    this.contextRepo = contextRepo;
  }

  async exportAllData(): Promise<string> {
    const data: Record<string, any> = {};

    try {
      // Use each service's exportData interface, with fixed key names for compatibility
      data['history'] = await this.historyManager.exportData();
      data['models'] = await this.modelManager.exportData();
      data['userTemplates'] = await this.templateManager.exportData();
      data['userSettings'] = await this.preferenceService.exportData();
      data['contexts'] = await this.contextRepo.exportData();
    } catch (error) {
      console.error('Failed to export data:', error);
      if (typeof (error as any)?.code === 'string') {
        throw toErrorWithCode(error)
      }
      throw new DataExportFailedError(error instanceof Error ? error.message : String(error))
    }

    const exportFormat = {
      version: 1,
      data
    };

    return JSON.stringify(exportFormat, null, 2); // Formatted output for easier debugging
  }

  async importAllData(dataString: string): Promise<void> {
    let exportData: any;

    try {
      exportData = JSON.parse(dataString);
    } catch (error) {
      throw new DataInvalidJsonError(error instanceof Error ? error.message : String(error))
    }

    if (!exportData || typeof exportData !== 'object' || Array.isArray(exportData)) {
      throw new DataInvalidFormatError('Data must be an object')
    }

    // Support both old and new format for backward compatibility
    let dataToImport: Record<string, any>;

    // New format: { version: 1, data: { ... } }
    if (exportData.version) {
      if (!exportData.data || typeof exportData.data !== 'object' || Array.isArray(exportData.data)) {
        throw new DataInvalidFormatError('"data" property is missing or not an object')
      }
      dataToImport = exportData.data;
    }
    // Old format: direct data object { history: [...], models: [...], ... }
    else if (exportData.history || exportData.models || exportData.userTemplates || exportData.userSettings || exportData.contexts) {
      dataToImport = exportData;
    }
    else {
      throw new DataInvalidFormatError('Unrecognized data structure')
    }

    const errors: string[] = [];

    // Use each service's importData interface
    const serviceMap = [
      { service: this.historyManager, dataKey: 'history' },
      { service: this.modelManager, dataKey: 'models' },
      { service: this.templateManager, dataKey: 'userTemplates' },
      { service: this.preferenceService, dataKey: 'userSettings' },
      { service: this.contextRepo, dataKey: 'contexts' }
    ];

    for (const { service, dataKey } of serviceMap) {
      if (dataToImport[dataKey] !== undefined) {
        try {
          await service.importData(dataToImport[dataKey]);
          console.log(`Successfully imported ${dataKey}`);
        } catch (error) {
          const errorMessage = `Failed to import ${dataKey}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      }
    }

    if (errors.length > 0) {
      throw new DataImportPartialFailedError(errors.length, errors.join('; '))
    }
  }
}

/**
 * Factory function for creating a data manager
 * @param modelManager Model manager instance
 * @param templateManager Template manager instance
 * @param historyManager History manager instance
 * @param preferenceService Preference service instance
 * @param contextRepo Context repository instance
 * @returns Data manager instance
 */
export function createDataManager(
  modelManager: IModelManager,
  templateManager: ITemplateManager,
  historyManager: IHistoryManager,
  preferenceService: IPreferenceService,
  contextRepo: ContextRepo
): DataManager {
  return new DataManager(modelManager, templateManager, historyManager, preferenceService, contextRepo);
}
