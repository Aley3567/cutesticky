import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const tauriConfig = JSON.parse(
  readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
) as { app: { windows: Array<{ minWidth?: number; minHeight?: number }> } }

function declarationFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('desktop window layout contract', () => {
  it('lets the desktop app fill a resized Tauri window', () => {
    const appRule = declarationFor('#app')

    expect(appRule).toContain('width: 100%')
    expect(appRule).toContain('height: 100%')
    expect(appRule).not.toMatch(/360px|480px|100vw|100vh/)
  })

  it('keeps the fixed preview canvas scoped to the web runtime', () => {
    const webRule = declarationFor("html[data-runtime='web'] #app")

    expect(webRule).toContain('360px')
    expect(webRule).toContain('480px')
  })

  it('prevents resizing below the layout design floor', () => {
    expect(tauriConfig.app.windows[0]).toMatchObject({ minWidth: 360, minHeight: 480 })
  })
})
