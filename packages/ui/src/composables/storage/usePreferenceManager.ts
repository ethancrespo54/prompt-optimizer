import { type Ref } from 'vue'

import type { AppServices } from '../../types/services'

/**
 * [Low-level helper] Get a preference
 * @param services Service reference
 * @param key Key name
 * @param defaultValue Default value
 * @returns The setting value or the default value
 * @throws Throws an error if preferenceService is unavailable
 */
export async function getPreference<T>(
  services: Ref<AppServices | null>,
  key: string, 
  defaultValue: T
): Promise<T> {
  if (services.value?.preferenceService) {
    return services.value.preferenceService.get(key, defaultValue);
  }
  throw new Error(`[getPreference] preferenceService is unavailable, cannot get the key: ${key}`);
}

/**
 * [Low-level helper] Set a preference
 * @param services Service reference
 * @param key Key name
 * @param value Value
 * @throws Throws an error if preferenceService is unavailable
 */
export async function setPreference<T>(
  services: Ref<AppServices | null>,
  key: string, 
  value: T
): Promise<void> {
  if (services.value?.preferenceService) {
    return services.value.preferenceService.set(key, value);
  }
  throw new Error(`[setPreference] preferenceService is unavailable, cannot set the key: ${key}`);
}

/**
 * [Recommended] Create a set of preference helper functions bound to a specific service instance.
 * This is the preferred way to use them in Vue components and composables.
 * 
 * @param services The services reference from useAppInitializer or inject
 * @returns An object containing the getPreference and setPreference methods, which do not require passing the services parameter repeatedly.
 */
export function usePreferences(services: Ref<AppServices | null>) {
  /**
   * Get the value of a preference
   */
  const get = <T>(key: string, defaultValue: T): Promise<T> => {
    return getPreference(services, key, defaultValue);
  };

  /**
   * Set the value of a preference
   */
  const set = <T>(key: string, value: T): Promise<void> => {
    return setPreference(services, key, value);
  };

  return { getPreference: get, setPreference: set };
} 