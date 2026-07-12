export interface TodoItem {
  id: number
  text: string
  done: boolean
  dueDate?: string
  createdAt: number
}

export type TodoGroupKey = 'today' | 'later' | 'completed'

export interface TodoGroups {
  today: TodoItem[]
  later: TodoItem[]
  completed: TodoItem[]
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeTodos(raw: unknown, now = Date.now()): TodoItem[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((value, index) => {
    if (!value || typeof value !== 'object') return []
    const candidate = value as Partial<TodoItem>
    if (typeof candidate.id !== 'number' || typeof candidate.text !== 'string') return []

    const dueDate = typeof candidate.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.dueDate)
      ? candidate.dueDate
      : undefined

    return [{
      id: candidate.id,
      text: candidate.text,
      done: Boolean(candidate.done),
      ...(dueDate ? { dueDate } : {}),
      createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : now + index,
    }]
  })
}

export function groupForTodo(todo: TodoItem, today = localDateKey()): TodoGroupKey {
  if (todo.done) return 'completed'
  if (todo.dueDate && todo.dueDate > today) return 'later'
  return 'today'
}

export function groupTodos(items: TodoItem[], today = localDateKey()): TodoGroups {
  const groups: TodoGroups = { today: [], later: [], completed: [] }
  for (const todo of items) groups[groupForTodo(todo, today)].push(todo)
  return groups
}

export function reorderTodos(items: TodoItem[], draggedId: number, targetId: number, today = localDateKey()): TodoItem[] {
  if (draggedId === targetId) return items

  const from = items.findIndex(todo => todo.id === draggedId)
  const to = items.findIndex(todo => todo.id === targetId)
  if (from < 0 || to < 0 || groupForTodo(items[from], today) !== groupForTodo(items[to], today)) return items

  const reordered = [...items]
  const [dragged] = reordered.splice(from, 1)
  if (!dragged) return items
  const targetIndex = reordered.findIndex(todo => todo.id === targetId)
  reordered.splice(targetIndex, 0, dragged)
  return reordered
}
