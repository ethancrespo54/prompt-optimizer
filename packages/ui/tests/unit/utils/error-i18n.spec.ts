import { describe, it, expect } from 'vitest'

import { i18n } from '../../../src/plugins/i18n'
import { getI18nErrorMessage } from '../../../src/utils/error'

describe('getI18nErrorMessage', () => {
  it('interpolates details into the localized message', () => {
    i18n.global.locale.value = 'en-US'
    const msg = getI18nErrorMessage({
      code: 'error.prompt.optimization',
      params: { details: 'DETAILS_X' },
    })

    expect(msg).toContain('DETAILS_X')
    // Debug prefix must not leak to users
    expect(msg).not.toContain('[error.')
  })

  it('interpolates context into the localized message', () => {
    i18n.global.locale.value = 'en-US'
    const msg = getI18nErrorMessage({
      code: 'error.history.not_found',
      params: { context: 'HISTORY_ID_1' },
    })

    expect(msg).toContain('HISTORY_ID_1')
  })

  it('falls back to error.message when the key does not exist', () => {
    const fallbackError = Object.assign(new Error('RAW_MESSAGE'), {
      code: 'error.nonexistent.key',
      params: { details: 'SHOULD_NOT_APPEAR' },
    })

    expect(getI18nErrorMessage(fallbackError)).toBe('RAW_MESSAGE')
  })
})
