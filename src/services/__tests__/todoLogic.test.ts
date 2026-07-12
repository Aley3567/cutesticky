import { describe, expect, it } from 'vitest'
import { groupTodos, normalizeTodos, reorderTodos, type TodoItem } from '../todoLogic'

function todo(id: number, dueDate?: string, done = false): TodoItem {
  return { id, text: `Task ${id}`, done, ...(dueDate ? { dueDate } : {}), createdAt: id }
}

describe('todo logic', () => {
  it('migrates the legacy todo shape without dropping entries', () => {
    expect(normalizeTodos([{ id: 4, text: 'Legacy', done: false }], 100)).toEqual([
      { id: 4, text: 'Legacy', done: false, createdAt: 100 },
    ])
  })

  it('groups undated and overdue tasks into today, future tasks into later, and done tasks into completed', () => {
    const groups = groupTodos([
      todo(1),
      todo(2, '2026-07-10'),
      todo(3, '2026-07-12'),
      todo(4, '2026-07-12', true),
    ], '2026-07-11')

    expect(groups.today.map(item => item.id)).toEqual([1, 2])
    expect(groups.later.map(item => item.id)).toEqual([3])
    expect(groups.completed.map(item => item.id)).toEqual([4])
  })

  it('only reorders tasks within the same visible group', () => {
    const items = [todo(1), todo(2), todo(3, '2026-07-12')]

    expect(reorderTodos(items, 2, 1, '2026-07-11').map(item => item.id)).toEqual([2, 1, 3])
    expect(reorderTodos(items, 1, 3, '2026-07-11')).toBe(items)
  })
})
