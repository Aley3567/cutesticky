import { describe, expect, it } from 'vitest'
import { filterAndSortNotes, reorderNotes } from '../notesLogic'
import type { Note } from '../notesStore'

function note(id: number, text: string, pinned = false): Note {
  return { id, text, pinned, color: 0, updatedAt: id }
}

describe('notes logic', () => {
  it('searches all note text case-insensitively and keeps pinned matches first', () => {
    const items = [note(1, 'Release Checklist'), note(2, 'release notes', true), note(3, '购物清单')]

    expect(filterAndSortNotes(items, ' RELEASE ').map(item => item.id)).toEqual([2, 1])
  })

  it('reorders notes inside the same pin group', () => {
    const items = [note(1, 'one'), note(2, 'two'), note(3, 'three')]

    expect(reorderNotes(items, 3, 1).map(item => item.id)).toEqual([3, 1, 2])
  })

  it('does not move a note across the pinned boundary', () => {
    const items = [note(1, 'pinned', true), note(2, 'normal')]

    expect(reorderNotes(items, 1, 2)).toBe(items)
  })
})
