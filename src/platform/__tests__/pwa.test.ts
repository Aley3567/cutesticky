import { describe, expect, it, vi } from 'vitest'
import { preloadOfflineGameChunks, serviceWorkerUrl } from '../pwa'

describe('PWA offline game preload', () => {
  it('versions the service worker URL with the app release', () => {
    expect(serviceWorkerUrl('0.2.1')).toBe('/sw.js?v=0.2.1')
    expect(serviceWorkerUrl('dev build')).toBe('/sw.js?v=dev%20build')
  })

  it('requests every lazy game chunk and tolerates one loader failing', async () => {
    const first = vi.fn(async () => ({ default: 'snake' }))
    const second = vi.fn(async () => { throw new Error('temporary network failure') })
    const third = vi.fn(async () => ({ default: 'tetris' }))

    await expect(preloadOfflineGameChunks([first, second, third])).resolves.toBeUndefined()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(third).toHaveBeenCalledOnce()
  })
})
