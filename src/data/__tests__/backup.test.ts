import { describe, expect, it } from 'vitest'
import type { PlatformStore } from '../../platform/types'
import {
  createBackup,
  importBackup,
  parseBackup,
  previewBackup,
  serializeBackup,
} from '../backup'
import { runDataMigrations } from '../migrations'
import { createSampleBackup } from '../sample'
import {
  BACKUP_FORMAT,
  CURRENT_SCHEMA_VERSION,
  LAST_IMPORT_BACKUP_KEY,
  SCHEMA_VERSION_KEY,
  type BackupEnvelope,
} from '../schema'

class MemoryStore implements PlatformStore {
  readonly values = new Map<string, unknown>()
  failOnceForKey: string | null = null

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.failOnceForKey === key) {
      this.failOnceForKey = null
      throw new Error('simulated storage failure')
    }
    this.values.set(key, value)
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key)
  }

  async clear(): Promise<void> {
    this.values.clear()
  }

  async keys(): Promise<string[]> {
    return [...this.values.keys()]
  }

  async entries<T = unknown>(): Promise<Array<[string, T]>> {
    return [...this.values.entries()] as Array<[string, T]>
  }

  async save(): Promise<void> {}
}

function backup(data: Record<string, unknown>): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: '2026-07-11T10:00:00.000Z',
    appVersion: '0.1.0',
    data,
  }
}

describe('data backup', () => {
  it('exports app data without internal keys or API keys by default', async () => {
    const store = new MemoryStore()
    store.values.set('notes', [{ id: 1, text: 'hello' }])
    store.values.set('llmConfig', { baseUrl: 'https://example.test', apiKey: 'secret', model: 'demo' })
    store.values.set(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION)

    const exported = await createBackup(store, { appVersion: 'test' })

    expect(exported.data.notes).toEqual([{ id: 1, text: 'hello' }])
    expect(exported.data.llmConfig).toEqual({ baseUrl: 'https://example.test', model: 'demo' })
    expect(exported.data).not.toHaveProperty(SCHEMA_VERSION_KEY)
    expect(previewBackup(exported)).toMatchObject({ keyCount: 2, containsSecrets: false })
  })

  it('only exports an API key after explicit opt-in', async () => {
    const store = new MemoryStore()
    store.values.set('llmConfig', { apiKey: 'secret' })

    const exported = await createBackup(store, { includeSecrets: true })

    expect(exported.data.llmConfig).toEqual({ apiKey: 'secret' })
    expect(previewBackup(exported).containsSecrets).toBe(true)
  })

  it('rejects unrelated JSON and backups from a newer schema', () => {
    expect(() => parseBackup('{"notes":[]}')).toThrow('不是 Cute Sticky 备份')
    expect(() => parseBackup(serializeBackup({ ...backup({}), schemaVersion: 999 }))).toThrow('高于当前支持')
  })

  it('replaces data and keeps an automatic pre-import recovery backup', async () => {
    const store = new MemoryStore()
    store.values.set('notes', ['before'])
    store.values.set('todos', ['old'])

    await importBackup(store, backup({ notes: ['after'] }))

    expect(await store.get('notes')).toEqual(['after'])
    expect(await store.get('todos')).toBeUndefined()
    expect(await store.get(LAST_IMPORT_BACKUP_KEY)).toEqual(expect.any(String))
    expect(await store.get(SCHEMA_VERSION_KEY)).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('preserves the local API key when a full backup omits that secret', async () => {
    const store = new MemoryStore()
    store.values.set('llmConfig', {
      baseUrl: 'https://old.example.test',
      apiKey: 'local-secret',
      model: 'old-model',
    })

    await importBackup(store, backup({
      llmConfig: { baseUrl: 'https://new.example.test', model: 'new-model' },
    }))

    expect(await store.get('llmConfig')).toEqual({
      baseUrl: 'https://new.example.test',
      apiKey: 'local-secret',
      model: 'new-model',
    })
  })

  it('overwrites the local API key when the backup explicitly contains one', async () => {
    const store = new MemoryStore()
    store.values.set('llmConfig', { apiKey: 'local-secret' })

    await importBackup(store, backup({ llmConfig: { apiKey: 'backup-secret' } }))

    expect(await store.get('llmConfig')).toEqual({ apiKey: 'backup-secret' })
  })

  it('preserves the local API key when an imported AI module only has chat history', async () => {
    const store = new MemoryStore()
    store.values.set('llmConfig', { baseUrl: 'https://local.example.test', apiKey: 'local-secret' })
    store.values.set('aiChatHistory', [{ role: 'assistant', content: 'old' }])

    await importBackup(store, backup({
      aiChatHistory: [{ role: 'assistant', content: 'new' }],
    }), { modules: ['ai'] })

    expect(await store.get('aiChatHistory')).toEqual([{ role: 'assistant', content: 'new' }])
    expect(await store.get('llmConfig')).toEqual({
      baseUrl: 'https://local.example.test',
      apiKey: 'local-secret',
    })
  })

  it('replaces only selected modules and clears stale keys within those modules', async () => {
    const store = new MemoryStore()
    store.values.set('memo', 'legacy note')
    store.values.set('notes', ['before'])
    store.values.set('todos', ['keep'])
    store.values.set('weatherCache:v1', { temperature: 20 })

    const result = await importBackup(store, backup({
      notes: ['after'],
      todos: ['backup todo'],
      activeTab: 'ai',
    }), { modules: ['notes'] })

    expect(result.importedModules).toEqual(['notes'])
    expect(await store.get('notes')).toEqual(['after'])
    expect(await store.get('memo')).toBeUndefined()
    expect(await store.get('todos')).toEqual(['keep'])
    expect(await store.get('weatherCache:v1')).toEqual({ temperature: 20 })
    expect(await store.get('activeTab')).toBeUndefined()
  })

  it('restores the original data if an import write fails', async () => {
    const store = new MemoryStore()
    store.values.set('notes', ['before'])
    store.values.set('todos', ['keep'])
    store.failOnceForKey = 'explode'

    await expect(importBackup(store, backup({ notes: ['after'], explode: true }))).rejects.toThrow('simulated')

    expect(await store.get('notes')).toEqual(['before'])
    expect(await store.get('todos')).toEqual(['keep'])
    expect(await store.get('explode')).toBeUndefined()
  })

  it('rolls back all data if a selected-module import fails', async () => {
    const store = new MemoryStore()
    store.values.set('notes', ['before'])
    store.values.set('todos', ['keep'])
    store.failOnceForKey = 'notes'

    await expect(importBackup(
      store,
      backup({ notes: ['after'], todos: ['do not import'] }),
      { modules: ['notes'] },
    )).rejects.toThrow('simulated')

    expect(await store.get('notes')).toEqual(['before'])
    expect(await store.get('todos')).toEqual(['keep'])
  })
})

describe('data migrations', () => {
  it('marks existing unversioned data as schema v1 without deleting it', async () => {
    const store = new MemoryStore()
    store.values.set('memo', 'legacy note')

    await runDataMigrations(store)

    expect(await store.get('memo')).toBe('legacy note')
    expect(await store.get(SCHEMA_VERSION_KEY)).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('sample data', () => {
  it('creates a valid, deterministic backup for web debugging', () => {
    const sample = createSampleBackup(new Date('2026-07-11T10:00:00+08:00'))

    expect(parseBackup(serializeBackup(sample))).toEqual(sample)
    expect(sample.data.notes).toHaveLength(2)
    expect(sample.data.todos).toHaveLength(3)
  })
})
