/**
 * Pinia service integration test
 *
 * Tests the integration of getPiniaServices() with the session store
 */

import type { IPreferenceService } from '@prompt-optimizer/core'
import { useBasicUserSession } from '../../src/stores/session/useBasicUserSession'
import { createTestPinia, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

describe('Pinia service integration', () => {
  it('the session store should be able to access services via getPiniaServices and persist', async () => {
    // ✅ Use the createTestPinia helper for more concise code
    const set = vi.fn<IPreferenceService['set']>().mockResolvedValue(undefined)

    const { pinia } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ set })
    })

    const store = useBasicUserSession(pinia)
    store.updatePrompt('hello')

    await store.saveSession()

    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]?.[0]).toBe('session/v1/basic-user')
    expect(typeof set.mock.calls[0]?.[1]).toBe('object')
    expect(set.mock.calls[0]?.[1]).toMatchObject({ prompt: 'hello' })
    // ✅ Cleanup is done automatically by the global afterEach; no manual cleanup needed
  })
})
