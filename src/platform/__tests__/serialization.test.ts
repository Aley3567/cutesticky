import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { snapshotStorageValue } from '../serialization'

describe('storage serialization', () => {
  it('unwraps Vue reactive proxies into a detached JSON snapshot', () => {
    const state = reactive({
      todos: [{ id: 1, text: 'focus', done: false }],
      nested: { count: 1 },
    })

    const snapshot = snapshotStorageValue(state)
    state.todos[0].done = true
    state.nested.count = 2

    expect(snapshot).toEqual({
      todos: [{ id: 1, text: 'focus', done: false }],
      nested: { count: 1 },
    })
  })

  it('rejects values that cannot be represented in the JSON store', () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic

    expect(() => snapshotStorageValue(cyclic)).toThrow('无法序列化保存')
    expect(() => snapshotStorageValue(undefined)).toThrow('不支持 undefined')
  })
})
