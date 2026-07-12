import { describe, expect, it } from 'vitest'
import {
  AUTOMATIC_UPDATE_INTERVAL_MS,
  automaticUpdateCheckDue,
  updateDownloadProgress,
} from '../src/services/updateService'

describe('update download progress', () => {
  it('calculates and rounds a bounded percentage', () => {
    expect(updateDownloadProgress(512, 1024)).toBe(50)
    expect(updateDownloadProgress(2, 3)).toBe(67)
    expect(updateDownloadProgress(2048, 1024)).toBe(100)
  })

  it('returns zero when the server does not provide a usable total', () => {
    expect(updateDownloadProgress(100)).toBe(0)
    expect(updateDownloadProgress(100, 0)).toBe(0)
  })

  it('limits background checks to one every six hours', () => {
    const lastCheck = 10_000
    expect(automaticUpdateCheckDue(lastCheck + AUTOMATIC_UPDATE_INTERVAL_MS - 1, lastCheck)).toBe(false)
    expect(automaticUpdateCheckDue(lastCheck + AUTOMATIC_UPDATE_INTERVAL_MS, lastCheck)).toBe(true)
  })
})
