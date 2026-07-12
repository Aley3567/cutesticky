import type { Note } from './notesStore'

export function filterAndSortNotes(items: Note[], query: string): Note[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matching = normalizedQuery
    ? items.filter(note => note.text.toLocaleLowerCase().includes(normalizedQuery))
    : items

  const pinned = matching.filter(note => note.pinned)
  const rest = matching.filter(note => !note.pinned)
  return [...pinned, ...rest]
}

export function reorderNotes(items: Note[], draggedId: number, targetId: number): Note[] {
  if (draggedId === targetId) return items

  const from = items.findIndex(note => note.id === draggedId)
  const to = items.findIndex(note => note.id === targetId)
  if (from < 0 || to < 0 || items[from].pinned !== items[to].pinned) return items

  const reordered = [...items]
  const [dragged] = reordered.splice(from, 1)
  if (!dragged) return items
  const targetIndex = reordered.findIndex(note => note.id === targetId)
  reordered.splice(targetIndex, 0, dragged)
  return reordered
}
