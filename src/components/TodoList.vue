<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { load } from '@tauri-apps/plugin-store'

interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = ref<Todo[]>([])
const newTodo = ref('')
let store: Awaited<ReturnType<typeof load>> | null = null
let nextId = 1

onMounted(async () => {
  store = await load('sticky-data.json', { autoSave: true })
  const saved = await store.get<Todo[]>('todos')
  if (saved && Array.isArray(saved)) {
    todos.value = saved
    nextId = saved.reduce((max, t) => Math.max(max, t.id + 1), 1)
  }
})

async function saveTodos() {
  await store?.set('todos', todos.value)
}

function addTodo() {
  const text = newTodo.value.trim()
  if (!text) return
  todos.value.push({ id: nextId++, text, done: false })
  newTodo.value = ''
  saveTodos()
}

function toggleTodo(id: number) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    todo.done = !todo.done
    saveTodos()
  }
}

function removeTodo(id: number) {
  todos.value = todos.value.filter(t => t.id !== id)
  saveTodos()
}
</script>

<template>
  <div class="todo-list">
    <div
      v-for="todo in todos"
      :key="todo.id"
      class="todo-item"
      :class="{ done: todo.done }"
    >
      <label class="todo-check">
        <input
          type="checkbox"
          :checked="todo.done"
          @change="toggleTodo(todo.id)"
        />
        <span class="checkmark" />
      </label>
      <span class="todo-text">{{ todo.text }}</span>
      <button class="todo-delete" @click="removeTodo(todo.id)">×</button>
    </div>

    <div class="todo-input-row">
      <input
        v-model="newTodo"
        class="todo-input"
        placeholder="添加新待办..."
        @keydown.enter="addTodo"
      />
    </div>
  </div>
</template>

<style scoped>
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.todo-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.todo-check {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.todo-check input {
  opacity: 0;
  width: 100%;
  height: 100%;
  position: absolute;
  cursor: pointer;
  margin: 0;
}

.checkmark {
  display: block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.todo-check input:checked ~ .checkmark {
  border-color: var(--header-color);
  background: var(--header-color);
}

.todo-check input:checked ~ .checkmark::after {
  content: '';
  display: block;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  margin: 1px 0 0 5px;
}

.todo-text {
  flex: 1;
  font-size: 14px;
  color: #555;
  transition: all 0.2s ease;
  user-select: text;
}

.done .todo-text {
  text-decoration: line-through;
  opacity: 0.4;
}

.todo-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
}

.todo-item:hover .todo-delete {
  opacity: 1;
}

.todo-delete:hover {
  background: color-mix(in srgb, var(--header-color) 10%, transparent);
  color: var(--header-color);
}

.todo-input-row {
  margin-top: 8px;
}

.todo-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  color: #555;
  padding: 8px 4px;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  user-select: text;
}

.todo-input::placeholder {
  color: #ccc;
}
</style>
