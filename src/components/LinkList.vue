<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { load } from '@tauri-apps/plugin-store'
import { open } from '@tauri-apps/plugin-shell'

interface LinkItem {
  id: number
  name: string
  url: string
}

const links = ref<LinkItem[]>([])
const inputValue = ref('')
const step = ref<1 | 2>(1)
const pendingUrl = ref('')
let store: Awaited<ReturnType<typeof load>> | null = null
let nextId = 1

onMounted(async () => {
  store = await load('sticky-data.json', { autoSave: true, defaults: {} })
  const saved = await store.get<LinkItem[]>('links')
  if (saved && Array.isArray(saved)) {
    links.value = saved
    nextId = saved.reduce((max, l) => Math.max(max, l.id + 1), 1)
  }
})

async function saveLinks() {
  await store?.set('links', links.value)
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function onEnter() {
  const val = inputValue.value.trim()
  if (!val) return

  if (step.value === 1) {
    pendingUrl.value = val
    inputValue.value = extractDomain(val)
    step.value = 2
  } else {
    links.value.push({
      id: nextId++,
      name: val,
      url: pendingUrl.value,
    })
    saveLinks()
    inputValue.value = ''
    pendingUrl.value = ''
    step.value = 1
  }
}

function removeLink(id: number) {
  links.value = links.value.filter(l => l.id !== id)
  saveLinks()
}

function openLink(url: string) {
  open(url)
}
</script>

<template>
  <div class="link-list">
    <div
      v-for="link in links"
      :key="link.id"
      class="link-item"
    >
      <span class="link-name" @click="openLink(link.url)">{{ link.name }}</span>
      <button class="link-delete" @click="removeLink(link.id)">×</button>
    </div>

    <div class="link-input-row">
      <input
        v-model="inputValue"
        class="link-input"
        :placeholder="step === 1 ? '粘贴链接...' : '给它起个名字...'"
        @keydown.enter="onEnter"
      />
    </div>
  </div>
</template>

<style scoped>
.link-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.link-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.link-name {
  flex: 1;
  font-size: 14px;
  color: var(--header-color);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: text;
}

.link-name:hover {
  text-decoration: underline;
}

.link-delete {
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

.link-item:hover .link-delete {
  opacity: 1;
}

.link-delete:hover {
  background: color-mix(in srgb, var(--header-color) 10%, transparent);
  color: var(--header-color);
}

.link-input-row {
  margin-top: 8px;
}

.link-input {
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

.link-input::placeholder {
  color: #ccc;
}
</style>
