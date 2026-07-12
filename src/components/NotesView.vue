<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { filterAndSortNotes, reorderNotes } from '../services/notesLogic'
import {
  notes,
  NOTE_COLORS,
  loadNotes,
  persistNotes,
  createNote,
  removeNote,
  togglePin,
  setColor,
  type Note,
} from '../services/notesStore'
import { addTodo } from '../services/todoStore'

interface UndoDelete {
  note: Note
  index: number
}

const listEl = ref<HTMLDivElement>()
const searchQuery = ref('')
const draggedId = ref<number | null>(null)
const openPaletteId = ref<number | null>(null)
const undoDelete = ref<UndoDelete | null>(null)
const notice = ref('')

const visibleNotes = computed(() => filterAndSortNotes(notes.value, searchQuery.value))
const resultLabel = computed(() => searchQuery.value.trim()
  ? `${visibleNotes.value.length} / ${notes.value.length} 条`
  : `${notes.value.length} 条`)

let saveTimer: ReturnType<typeof setTimeout> | null = null
let undoTimer: ReturnType<typeof setTimeout> | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await loadNotes()
})

onActivated(() => {
  window.addEventListener('keydown', onGlobalShortcut)
})

onDeactivated(() => {
  window.removeEventListener('keydown', onGlobalShortcut)
  openPaletteId.value = null
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalShortcut)
  if (saveTimer) clearTimeout(saveTimer)
  if (undoTimer) clearTimeout(undoTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
})

function onGlobalShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'n') {
    event.preventDefault()
    void addNote()
  }
}

function onEdit(note: Note) {
  openPaletteId.value = null
  note.updatedAt = Date.now()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNotes, 500)
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function noteStyle(note: Note) {
  const palette = NOTE_COLORS[note.color] ?? NOTE_COLORS[0]
  return { '--note-accent': palette.accent, '--note-tint': palette.tint }
}

function chooseColor(noteId: number, color: number) {
  setColor(noteId, color)
  openPaletteId.value = null
}

async function addNote() {
  await loadNotes()
  searchQuery.value = ''
  const note = createNote()
  await nextTick()
  listEl.value
    ?.querySelector<HTMLTextAreaElement>(`[data-note-id="${note.id}"] textarea`)
    ?.focus()
}

function deleteNote(note: Note) {
  const index = notes.value.findIndex(item => item.id === note.id)
  if (index < 0) return

  if (undoTimer) clearTimeout(undoTimer)
  undoDelete.value = { note: { ...note }, index }
  removeNote(note.id)
  undoTimer = setTimeout(() => {
    undoDelete.value = null
    undoTimer = null
  }, 5000)
}

function restoreDeletedNote() {
  if (!undoDelete.value) return
  const { note, index } = undoDelete.value
  notes.value.splice(Math.min(index, notes.value.length), 0, note)
  undoDelete.value = null
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = null
  void persistNotes()
}

async function convertToTodo(note: Note) {
  if (!note.text.trim()) return
  const todo = await addTodo(note.text)
  if (todo) showNotice('已加入待办，原便签已保留')
}

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 2600)
}

function onDragStart(event: DragEvent, note: Note) {
  if (searchQuery.value.trim()) {
    event.preventDefault()
    return
  }
  draggedId.value = note.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(note.id))
  }
}

function onDrop(target: Note) {
  if (draggedId.value === null || searchQuery.value.trim()) return
  const reordered = reorderNotes(notes.value, draggedId.value, target.id)
  if (reordered !== notes.value) {
    notes.value = reordered
    void persistNotes()
  }
  draggedId.value = null
}

function autoGrow(event: Event) {
  const element = event.target as HTMLTextAreaElement
  growTextarea(element)
}

function growTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

const vGrow = { mounted: growTextarea, updated: growTextarea }
</script>

<template>
  <div class="notes-view">
    <div class="sect-h">
      <h3>便签</h3>
      <span v-if="notes.length" class="cnt">{{ resultLabel }}</span>
      <button class="plus" :class="{ solo: !notes.length }" @click="addNote" title="新建便签（⌘/Ctrl + N）" aria-label="新建便签">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>

    <label v-if="notes.length" class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>
      </svg>
      <input v-model="searchQuery" type="search" placeholder="搜索全部便签" aria-label="搜索全部便签" />
      <button v-if="searchQuery" type="button" @click="searchQuery = ''" title="清除搜索" aria-label="清除搜索">×</button>
    </label>

    <div v-if="!notes.length" class="empty-hint" @click="addNote">
      点这里写下第一条便签…
    </div>

    <div v-else-if="!visibleNotes.length" class="empty-hint search-empty">
      没有找到匹配的便签
      <button @click="searchQuery = ''">清除搜索</button>
    </div>

    <div v-else ref="listEl" class="note-list">
      <article
        v-for="note in visibleNotes"
        :key="note.id"
        class="note"
        :class="{ dragging: draggedId === note.id }"
        :data-note-id="note.id"
        :style="noteStyle(note)"
        @dragover.prevent
        @drop="onDrop(note)"
      >
        <svg v-if="note.pinned" class="pin-mark" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 3l5 5-6 2-4 8-2-2-5 5-1-1 5-5-2-2 8-4 2-6z"/>
        </svg>
        <textarea
          v-model="note.text"
          v-grow
          class="note-text"
          rows="1"
          placeholder="写点什么…"
          @input="onEdit(note); autoGrow($event)"
        />
        <div class="note-foot">
          <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
          <span class="note-tools">
            <span class="color-control">
              <button
                class="tool-btn color-trigger"
                title="更换颜色"
                aria-label="更换便签颜色"
                :aria-expanded="openPaletteId === note.id"
                @click.stop="openPaletteId = openPaletteId === note.id ? null : note.id"
              >
                <i :style="{ background: NOTE_COLORS[note.color]?.accent || NOTE_COLORS[0].accent }" />
              </button>
              <Transition name="palette-pop">
                <span v-if="openPaletteId === note.id" class="color-menu" @click.stop>
                  <button
                    v-for="(color, index) in NOTE_COLORS"
                    :key="color.name"
                    class="color-dot"
                    :class="{ sel: note.color === index }"
                    :style="{ background: color.accent }"
                    :title="color.name"
                    :aria-label="`设为${color.name}色`"
                    @click="chooseColor(note.id, index)"
                  />
                </span>
              </Transition>
            </span>
            <button class="tool-btn" :disabled="!note.text.trim()" @click="convertToTodo(note)" title="加入待办" aria-label="加入待办">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12l4 4 8-9M14 16h6"/>
              </svg>
            </button>
            <button class="tool-btn" :class="{ on: note.pinned }" @click="togglePin(note.id)" :title="note.pinned ? '取消置顶' : '置顶'" :aria-label="note.pinned ? '取消置顶' : '置顶'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 3l5 5-6 2-4 8-2-2-5 5-1-1 5-5-2-2 8-4 2-6z"/>
              </svg>
            </button>
            <button class="tool-btn drag-handle" :draggable="!searchQuery.trim()" @dragstart="onDragStart($event, note)" @dragend="draggedId = null" :title="searchQuery.trim() ? '清除搜索后可排序' : '拖动排序'" aria-label="拖动排序">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="7" r="1.5"/><circle cx="16" cy="7" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/></svg>
            </button>
            <button class="tool-btn" @click="deleteNote(note)" title="删除" aria-label="删除便签">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </span>
        </div>
      </article>
    </div>

    <div v-if="undoDelete" class="toast" role="status" aria-live="polite">
      <span>便签已删除</span>
      <button @click="restoreDeletedNote">撤销</button>
    </div>
    <div v-else-if="notice" class="toast" role="status" aria-live="polite">{{ notice }}</div>
  </div>
</template>

<style scoped>
.notes-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.sect-h {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex: none;
}

.sect-h h3 { font-size: 15px; font-weight: 800; color: var(--ink-1); }
.sect-h .cnt {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-color);
  background: var(--accent-soft);
  padding: 3px 9px;
  border-radius: 999px;
  margin-left: auto;
}

.plus {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 10px;
  background: var(--accent-color);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-shadow: 0 4px 10px var(--accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease;
}
.plus.solo { margin-left: auto; }
.plus:hover { transform: translateY(-1px); }
.plus svg { width: 13px; height: 13px; }

.search-box {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  margin-bottom: var(--space-3);
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
  color: var(--ink-3);
}
.search-box > svg { width: 13px; height: 13px; flex: none; }
.search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink-1);
  font-size: 12px;
}
.search-box input::placeholder { color: var(--ink-3); }
.search-box input::-webkit-search-cancel-button { display: none; }
.search-box button {
  border: 0;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  font-size: 17px;
  line-height: 1;
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  font-size: 13px;
  cursor: text;
}
.search-empty { flex-direction: column; gap: var(--space-2); cursor: default; }
.search-empty button, .toast button {
  border: 0;
  background: transparent;
  color: var(--accent-color);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.note-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-2);
  overflow-y: auto;
  min-height: 0;
  padding: 1px 1px var(--space-1);
}

.note {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--note-accent) 8%, white);
  background: color-mix(in srgb, var(--surface-color) 88%, var(--note-tint));
  border-radius: var(--radius-md);
  box-shadow: 0 6px 16px rgba(43, 38, 33, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  padding: 13px 14px 9px 16px;
  flex: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.note::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 6px;
  width: 3px;
  border-radius: 99px;
  background: var(--note-accent);
  content: '';
  opacity: 0.72;
}
.note.dragging { opacity: 0.45; transform: scale(0.99); }
.note:only-child { min-height: 100%; display: flex; flex-direction: column; }
.note:only-child .note-text { flex: 1; max-height: none; }
.pin-mark { position: absolute; top: 10px; right: 12px; width: 12px; height: 12px; color: var(--note-accent); }

.note-text {
  width: 100%;
  min-height: 22px;
  max-height: 184px;
  padding: 1px 2px 6px 0;
  border: none;
  outline: none;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.62;
  color: var(--ink-1);
  user-select: text;
}
.note-text::placeholder { color: var(--ink-3); }

.note-foot {
  display: flex;
  align-items: center;
  min-height: 25px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--note-accent) 10%, transparent);
}
.note-time { font-size: 10px; font-weight: 600; color: var(--ink-3); white-space: nowrap; }
.note-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.58;
  transition: opacity 0.15s ease;
}
.note:hover .note-tools, .note:focus-within .note-tools { opacity: 1; }

.color-control { position: relative; display: flex; }
.color-trigger i {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(43, 38, 33, 0.16);
}
.color-menu {
  position: absolute;
  z-index: 4;
  right: -4px;
  bottom: 24px;
  display: flex;
  gap: 7px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-color);
  box-shadow: 0 10px 22px rgba(43, 38, 33, 0.16);
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(43, 38, 33, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.color-dot.sel { outline: 2px solid rgba(43, 38, 33, 0.18); outline-offset: 1px; }
.palette-pop-enter-active, .palette-pop-leave-active { transition: opacity .14s ease, transform .14s ease; }
.palette-pop-enter-from, .palette-pop-leave-to { opacity: 0; transform: translateY(3px) scale(.96); }

.tool-btn {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;
}
.tool-btn svg { width: 12px; height: 12px; }
.tool-btn:hover, .tool-btn.on { color: var(--note-accent); background: color-mix(in srgb, var(--note-tint) 70%, transparent); }
.tool-btn:disabled { opacity: 0.35; cursor: default; background: transparent; }
.drag-handle { cursor: grab; }
.drag-handle:active { cursor: grabbing; }

.toast {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex: none;
  margin-top: var(--space-2);
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  background: var(--ink-1);
  color: var(--surface-color);
  font-size: 11px;
  font-weight: 700;
  box-shadow: var(--shadow-raised);
}

@media (hover: none) {
  .note-tools { opacity: 1; }
}
</style>
