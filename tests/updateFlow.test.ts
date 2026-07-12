import { beforeEach, describe, expect, it, vi } from 'vitest'

const updaterMocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
}))

vi.mock('../src/platform', () => ({ isDesktopRuntime: true }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: updaterMocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: updaterMocks.relaunch }))

describe('desktop update flow', () => {
  beforeEach(() => {
    vi.resetModules()
    updaterMocks.check.mockReset()
    updaterMocks.relaunch.mockReset()
    updaterMocks.relaunch.mockResolvedValue(undefined)
  })

  it('checks, downloads, installs and relaunches through one state machine', async () => {
    const downloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } })
      onEvent({ event: 'Progress', data: { chunkLength: 60 } })
      onEvent({ event: 'Progress', data: { chunkLength: 40 } })
      onEvent({ event: 'Finished' })
    })
    updaterMocks.check.mockResolvedValue({
      currentVersion: '0.2.0',
      version: '0.2.1',
      body: 'Hardening update',
      downloadAndInstall,
    })

    const update = await import('../src/services/updateService')
    await update.checkForUpdates(true)

    expect(update.updateState).toMatchObject({
      phase: 'available',
      visible: true,
      currentVersion: '0.2.0',
      version: '0.2.1',
      notes: 'Hardening update',
    })

    await update.installPendingUpdate()

    expect(downloadAndInstall).toHaveBeenCalledOnce()
    expect(update.updateState.progress).toBe(100)
    expect(update.updateState.phase).toBe('restarting')
    expect(updaterMocks.relaunch).toHaveBeenCalledOnce()
  })
})
