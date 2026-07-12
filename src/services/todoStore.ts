import { ref } from 'vue'
import { loadStickyStore, type StickyStore } from './stickyStore'
import { normalizeTodos, reorderTodos, type TodoItem } from './todoLogic'

export const todos = ref<TodoItem[]>([])

let store: StickyStore | null = null
let loadPromise: Promise<void> | null = null
let nextId = 1

export function loadTodos(): Promise<void> {
  if (!loadPromise) loadPromise = doLoad()
  return loadPromise
}

async function doLoad() {
  store = await loadStickyStore()
  todos.value = normalizeTodos(await store.get<unknown>('todos'))
  nextId = todos.value.reduce((max, todo) => Math.max(max, todo.id + 1), 1)
}

export async function persistTodos() {
  await loadTodos()
  await store?.set('todos', todos.value)
  await store?.save()
}

export async function addTodo(text: string, dueDate?: string): Promise<TodoItem | null> {
  const normalized = text.trim()
  if (!normalized) return null
  await loadTodos()

  const todo: TodoItem = {
    id: nextId++,
    text: normalized,
    done: false,
    ...(dueDate ? { dueDate } : {}),
    createdAt: Date.now(),
  }
  todos.value.push(todo)
  await persistTodos()
  return todo
}

export async function toggleTodo(id: number) {
  await loadTodos()
  const todo = todos.value.find(item => item.id === id)
  if (!todo) return
  todo.done = !todo.done
  await persistTodos()
}

export async function removeTodo(id: number) {
  await loadTodos()
  todos.value = todos.value.filter(todo => todo.id !== id)
  await persistTodos()
}

export async function setTodoDueDate(id: number, dueDate?: string) {
  await loadTodos()
  const todo = todos.value.find(item => item.id === id)
  if (!todo) return
  if (dueDate) todo.dueDate = dueDate
  else delete todo.dueDate
  await persistTodos()
}

export async function moveTodo(draggedId: number, targetId: number) {
  await loadTodos()
  const reordered = reorderTodos(todos.value, draggedId, targetId)
  if (reordered === todos.value) return
  todos.value = reordered
  await persistTodos()
}
