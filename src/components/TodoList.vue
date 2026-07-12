<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { groupTodos, localDateKey, type TodoGroupKey, type TodoItem } from '../services/todoLogic'
import {
  todos,
  addTodo,
  loadTodos,
  moveTodo,
  removeTodo,
  setTodoDueDate,
  toggleTodo,
} from '../services/todoStore'
import { pomodoroState, startFocusForTodo } from '../services/pomodoroStore'

const newTodo = ref('')
const newDueDate = ref('')
const showDuePicker = ref(false)
const completedOpen = ref(false)
const draggedId = ref<number | null>(null)
const notice = ref('')

const today = computed(() => localDateKey())
const groups = computed(() => groupTodos(todos.value, today.value))
const doneCount = computed(() => groups.value.completed.length)
const sections = computed(() => [
  { key: 'today' as const, label: '今天', items: groups.value.today, open: true },
  { key: 'later' as const, label: '以后', items: groups.value.later, open: true },
  { key: 'completed' as const, label: '已完成', items: groups.value.completed, open: completedOpen.value },
])

let noticeTimer: ReturnType<typeof setTimeout> | null = null

onMounted(loadTodos)
onUnmounted(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})

async function createTodo() {
  const todo = await addTodo(newTodo.value, newDueDate.value || undefined)
  if (!todo) return
  newTodo.value = ''
  newDueDate.value = ''
  showDuePicker.value = false
}

function changeDueDate(todo: TodoItem, event: Event) {
  const value = (event.target as HTMLInputElement).value
  void setTodoDueDate(todo.id, value || undefined)
}

async function startFocus(todo: TodoItem) {
  await startFocusForTodo({ id: todo.id, text: todo.text })
  showNotice(`已开始专注：${todo.text}`)
}

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 2600)
}

function formatDueDate(value: string): string {
  if (value === today.value) return '今天截止'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (value === localDateKey(tomorrow)) return '明天截止'

  const [, month, day] = value.split('-')
  return `${Number(month)} 月 ${Number(day)} 日`
}

function isOverdue(todo: TodoItem): boolean {
  return Boolean(todo.dueDate && todo.dueDate < today.value && !todo.done)
}

function sectionCountLabel(key: TodoGroupKey, count: number): string {
  return key === 'completed' && count > 0 ? `${count}` : ''
}

function onDragStart(event: DragEvent, todo: TodoItem) {
  draggedId.value = todo.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(todo.id))
  }
}

function onDrop(target: TodoItem) {
  if (draggedId.value === null) return
  void moveTodo(draggedId.value, target.id)
  draggedId.value = null
}
</script>

<template>
  <div class="todo-view">
    <div class="sect-h">
      <h3>待办清单</h3>
      <span v-if="todos.length" class="cnt">{{ doneCount }} / {{ todos.length }} 完成</span>
    </div>

    <div class="todo-add">
      <div class="add-main">
        <input
          v-model="newTodo"
          class="todo-input"
          placeholder="添加一件新的小事…"
          aria-label="待办内容"
          @keydown.enter="createTodo"
        />
        <button class="date-toggle" :class="{ active: showDuePicker || newDueDate }" @click="showDuePicker = !showDuePicker" title="设置截止日期" aria-label="设置截止日期">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>
          </svg>
        </button>
        <button class="plus" @click="createTodo" aria-label="添加待办">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
      <div v-if="showDuePicker" class="due-picker">
        <span>截止日期</span>
        <input v-model="newDueDate" type="date" :min="today" aria-label="新待办截止日期" />
        <button v-if="newDueDate" @click="newDueDate = ''">清除</button>
      </div>
    </div>

    <div v-if="!todos.length" class="empty-hint">还没有待办事项</div>

    <div v-else class="todo-list">
      <section v-for="section in sections" v-show="section.items.length" :key="section.key" class="todo-section">
        <button
          class="group-heading"
          :class="{ clickable: section.key === 'completed' }"
          :disabled="section.key !== 'completed'"
          @click="section.key === 'completed' && (completedOpen = !completedOpen)"
        >
          <span>{{ section.label }}</span>
          <span v-if="sectionCountLabel(section.key, section.items.length)" class="group-count">{{ sectionCountLabel(section.key, section.items.length) }}</span>
          <svg v-if="section.key === 'completed'" :class="{ open: section.open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m8 10 4 4 4-4"/></svg>
        </button>

        <div v-if="section.open" class="group-items">
          <article
            v-for="todo in section.items"
            :key="todo.id"
            class="todo"
            :class="{ done: todo.done, dragging: draggedId === todo.id }"
            @dragover.prevent
            @drop="onDrop(todo)"
          >
            <button class="drag-handle" draggable="true" @dragstart="onDragStart($event, todo)" @dragend="draggedId = null" title="拖动排序" aria-label="拖动排序">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="7" r="1.5"/><circle cx="16" cy="7" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/></svg>
            </button>
            <button class="box" @click="toggleTodo(todo.id)" :aria-label="todo.done ? '标记为未完成' : '标记为完成'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12l5 5L20 6"/>
              </svg>
            </button>
            <div class="todo-copy">
              <span class="txt">{{ todo.text }}</span>
              <span v-if="todo.dueDate" class="due-label" :class="{ overdue: isOverdue(todo) }">
                {{ isOverdue(todo) ? '已逾期 · ' : '' }}{{ formatDueDate(todo.dueDate) }}
              </span>
            </div>
            <label class="inline-date" title="修改截止日期">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
              <input type="date" :value="todo.dueDate || ''" @change="changeDueDate(todo, $event)" :aria-label="`修改 ${todo.text} 的截止日期`" />
            </label>
            <button
              v-if="!todo.done"
              class="row-action focus-action"
              :class="{ active: pomodoroState.running && pomodoroState.activeTask?.id === todo.id }"
              @click="startFocus(todo)"
              :title="pomodoroState.running && pomodoroState.activeTask?.id === todo.id ? '正在专注' : '开始 25 分钟专注'"
              aria-label="开始番茄专注"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/></svg>
            </button>
            <button class="row-action todo-delete" @click="removeTodo(todo.id)" title="删除" aria-label="删除待办">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </article>
        </div>
      </section>
    </div>

    <div v-if="notice" class="toast" role="status" aria-live="polite">{{ notice }}</div>
  </div>
</template>

<style scoped>
.todo-view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sect-h { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); flex: none; }
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

.todo-add {
  display: flex;
  flex-direction: column;
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  box-shadow: var(--shadow-raised);
  margin-bottom: var(--space-3);
  flex: none;
}
.add-main { display: flex; align-items: center; gap: var(--space-2); padding-left: var(--space-2); }
.todo-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13px; color: var(--ink-1); }
.todo-input::placeholder { color: var(--ink-3); }

.plus, .date-toggle {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.plus {
  background: var(--accent-color);
  color: #fff;
  box-shadow: 0 4px 10px var(--accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease;
}
.plus:hover { transform: translateY(-1px); }
.plus svg { width: 15px; height: 15px; }
.date-toggle { background: transparent; color: var(--ink-3); }
.date-toggle.active { color: var(--accent-color); background: var(--accent-soft); }
.date-toggle svg { width: 15px; height: 15px; }

.due-picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-2) 0;
  border-top: 1px solid var(--line);
  color: var(--ink-2);
  font-size: 11px;
  font-weight: 700;
}
.due-picker input { flex: 1; border: 0; outline: 0; background: var(--tint-color); color: var(--ink-1); border-radius: 8px; padding: 5px 8px; font-size: 11px; }
.due-picker button { border: 0; background: transparent; color: var(--accent-color); font-size: 11px; font-weight: 800; cursor: pointer; }

.empty-hint { flex: 1; display: grid; place-items: center; color: var(--ink-3); font-size: 13px; }
.todo-list { display: flex; flex-direction: column; gap: var(--space-3); overflow-y: auto; min-height: 0; padding: 1px 1px var(--space-1); }
.todo-section { display: flex; flex-direction: column; gap: 6px; flex: none; }
.group-heading {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-align: left;
}
.group-heading.clickable { cursor: pointer; }
.group-heading:disabled { opacity: 1; }
.group-heading svg { width: 13px; height: 13px; margin-left: auto; transition: transform 0.15s ease; }
.group-heading svg.open { transform: rotate(180deg); }
.group-count { padding: 1px 6px; border-radius: 999px; background: var(--tint-color); color: var(--ink-2); }
.group-items { display: flex; flex-direction: column; gap: var(--space-2); }

.todo {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 46px;
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: 8px 9px 8px 6px;
  box-shadow: var(--shadow-raised);
  flex: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.todo.dragging { opacity: 0.45; transform: scale(0.99); }
.drag-handle {
  width: 15px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--ink-3);
  cursor: grab;
  flex: none;
}
.drag-handle:active { cursor: grabbing; }
.drag-handle svg { width: 11px; height: 17px; }
.box {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 8px;
  flex: none;
  cursor: pointer;
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  transition: background 0.15s ease;
}
.box svg { width: 13px; height: 13px; opacity: 0; transition: opacity 0.15s ease; }
.todo-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.txt {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
  color: var(--ink-1);
  user-select: text;
  transition: color 0.15s ease;
}
.due-label { font-size: 9px; font-weight: 700; color: var(--ink-3); }
.due-label.overdue { color: var(--accent-color); }

.inline-date { position: relative; width: 20px; height: 22px; flex: none; color: var(--ink-3); cursor: pointer; }
.inline-date svg { position: absolute; inset: 4px 3px; width: 14px; height: 14px; pointer-events: none; }
.inline-date input { position: absolute; inset: 0; width: 20px; height: 22px; opacity: 0; cursor: pointer; }
.row-action {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  opacity: 0;
  transition: color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}
.row-action svg { width: 13px; height: 13px; }
.todo:hover .row-action, .todo:focus-within .row-action, .focus-action.active { opacity: 1; }
.row-action:hover, .focus-action.active { background: var(--accent-soft); color: var(--accent-color); }

.todo.done { opacity: 0.68; }
.todo.done .box { background: var(--accent-color); box-shadow: 0 3px 8px var(--accent-soft); color: #fff; }
.todo.done .box svg { opacity: 1; }
.todo.done .txt { color: var(--ink-3); text-decoration: line-through; text-decoration-color: var(--ink-3); }

.toast {
  min-height: 34px;
  flex: none;
  margin-top: var(--space-2);
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  background: var(--ink-1);
  color: var(--surface-color);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  box-shadow: var(--shadow-raised);
}

@media (hover: none) {
  .row-action { opacity: 1; }
}
</style>
