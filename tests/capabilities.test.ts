import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const desktopCapability = JSON.parse(
  readFileSync(new URL('../src-tauri/capabilities/desktop.json', import.meta.url), 'utf8'),
) as { permissions?: string[] }

describe('desktop update capability contract', () => {
  it('allows updater access and the restart required after installation', () => {
    expect(desktopCapability.permissions).toContain('updater:default')
    expect(desktopCapability.permissions).toContain('process:allow-restart')
  })
})
