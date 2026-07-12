import { ref } from 'vue'
import { loadStickyStore, type StickyStore } from './stickyStore'

export interface Note {
  id: number
  text: string
  /** 颜色索引，对应 NOTE_COLORS */
  color: number
  pinned: boolean
  updatedAt: number
}

/** 便签色卡，与应用 5 套主题同源 */
export const NOTE_COLORS = [
  { name: '蜜桃', accent: '#FF8C55', tint: '#FFF1E8' },
  { name: '薄荷', accent: '#2FB37A', tint: '#E9F8F0' },
  { name: '天空', accent: '#4C8FDB', tint: '#E9F2FD' },
  { name: '紫藤', accent: '#9C76BD', tint: '#F2ECFA' },
  { name: '樱花', accent: '#E87E95', tint: '#FCEBEF' },
]

export const notes = ref<Note[]>([])

let store: StickyStore | null = null
let loadPromise: Promise<void> | null = null
let nextId = 1

export function loadNotes(): Promise<void> {
  if (!loadPromise) loadPromise = doLoad()
  return loadPromise
}

async function doLoad() {
  store = await loadStickyStore()
  const saved = await store.get<Note[]>('notes')
  if (saved && Array.isArray(saved)) {
    notes.value = saved
  } else {
    // 旧版单文本备忘迁移为第一条便签
    const legacy = await store.get<string>('memo')
    if (legacy && legacy.trim()) {
      notes.value = [{ id: 1, text: legacy, color: 0, pinned: false, updatedAt: Date.now() }]
      await persistNotes()
    }
  }
  nextId = notes.value.reduce((max, n) => Math.max(max, n.id + 1), 1)
}

export async function persistNotes() {
  try {
    await store?.set('notes', notes.value)
    await store?.save()
  } catch (e) {
    console.error('便签保存失败', e)
  }
}

export function createNote(): Note {
  const note: Note = { id: nextId++, text: '', color: 0, pinned: false, updatedAt: Date.now() }
  notes.value.unshift(note)
  persistNotes()
  return note
}

export function removeNote(id: number) {
  notes.value = notes.value.filter(n => n.id !== id)
  persistNotes()
}

export function togglePin(id: number) {
  const note = notes.value.find(n => n.id === id)
  if (!note) return
  note.pinned = !note.pinned
  persistNotes()
}

export function setColor(id: number, color: number) {
  const note = notes.value.find(n => n.id === id)
  if (!note) return
  note.color = color
  persistNotes()
}
