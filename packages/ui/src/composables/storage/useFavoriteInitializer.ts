import { useI18n } from 'vue-i18n';
import type { IFavoriteManager } from '@prompt-optimizer/core';

/**
 * Favorites feature initializer
 * Responsible for creating the internationalized default categories
 */
export function useFavoriteInitializer(manager: IFavoriteManager) {
  const { t } = useI18n();

  /**
   * Ensure the default categories exist (created only on first use)
   */
  const ensureDefaultCategories = async () => {
    const defaultCategories = [
      {
        name: t('favorites.categories.default.uncategorized'),
        description: t('favorites.categories.default.uncategorizedDesc'),
        color: '#6B7280'
      },
      {
        name: t('favorites.categories.default.creativeWriting'),
        description: t('favorites.categories.default.creativeWritingDesc'),
        color: '#8B5CF6'
      },
      {
        name: t('favorites.categories.default.programming'),
        description: t('favorites.categories.default.programmingDesc'),
        color: '#F59E0B'
      },
      {
        name: t('favorites.categories.default.businessAnalysis'),
        description: t('favorites.categories.default.businessAnalysisDesc'),
        color: '#EF4444'
      },
      {
        name: t('favorites.categories.default.learning'),
        description: t('favorites.categories.default.learningDesc'),
        color: '#10B981'
      },
      {
        name: t('favorites.categories.default.dailyAssistant'),
        description: t('favorites.categories.default.dailyAssistantDesc'),
        color: '#3B82F6'
      }
    ];

    await manager.ensureDefaultCategories(defaultCategories);
  };

  return {
    ensureDefaultCategories
  };
}
