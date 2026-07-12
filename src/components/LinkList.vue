<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadStickyStore, type StickyStore } from '../services/stickyStore'
import { openExternal } from '../platform'

interface LinkItem {
  id: number
  name: string
  url: string
}

const links = ref<LinkItem[]>([])
const inputValue = ref('')
const step = ref<1 | 2>(1)
const pendingUrl = ref('')
let store: StickyStore | null = null
let nextId = 1

onMounted(async () => {
  store = await loadStickyStore()
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

function normalizeUrl(value: string): string {
  return /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`
}

function onEnter() {
  const val = inputValue.value.trim()
  if (!val) return

  if (step.value === 1) {
    pendingUrl.value = normalizeUrl(val)
    inputValue.value = extractDomain(pendingUrl.value)
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

async function openLink(url: string) {
  await openExternal(normalizeUrl(url))
}
</script>

<template>
  <div class="link-view">
    <div class="sect-h">
      <h3>常用链接</h3>
      <span v-if="links.length" class="cnt">{{ links.length }} 个</span>
    </div>

    <div class="link-add" :class="{ naming: step === 2 }">
      <input
        v-model="inputValue"
        class="link-input"
        :placeholder="step === 1 ? '粘贴链接…' : '给它起个名字…'"
        @keydown.enter="onEnter"
      />
      <button class="plus" @click="onEnter">
        <svg v-if="step === 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12l5 5L20 6"/>
        </svg>
      </button>
    </div>

    <div class="link-list">
      <div
        v-for="link in links"
        :key="link.id"
        class="link-item"
        @click="openLink(link.url)"
      >
        <span class="link-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </span>
        <span class="link-meta">
          <span class="link-name">{{ link.name }}</span>
          <span class="link-domain">{{ extractDomain(link.url) }}</span>
        </span>
        <button class="link-delete" @click.stop="removeLink(link.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.link-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sect-h {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.sect-h h3 {
  font-size: 15px;
  font-weight: 800;
  color: var(--ink-1);
}

.sect-h .cnt {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-color);
  background: var(--accent-soft);
  padding: 3px 9px;
  border-radius: 999px;
  margin-left: auto;
}

.link-add {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  box-shadow: var(--shadow-raised);
  margin-bottom: var(--space-3);
  flex: none;
}

.link-add.naming {
  box-shadow: var(--shadow-raised), 0 0 0 2px var(--accent-soft);
}

.link-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-1);
}

.link-input::placeholder {
  color: var(--ink-3);
}

.plus {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 11px;
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

.plus:hover {
  transform: translateY(-1px);
}

.plus:active {
  transform: none;
}

.plus svg {
  width: 15px;
  height: 15px;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
  min-height: 0;
  padding-bottom: var(--space-1);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  flex: none;
  transition: transform 0.15s ease;
}

.link-item:hover {
  transform: translateY(-1px);
}

.link-ico {
  width: 30px;
  height: 30px;
  border-radius: 11px;
  flex: none;
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.link-ico svg {
  width: 14px;
  height: 14px;
}

.link-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.link-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-domain {
  font-size: 10.5px;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-delete {
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
  opacity: 0;
  flex: none;
  transition: all 0.2s ease;
}

.link-delete svg {
  width: 11px;
  height: 11px;
}

.link-item:hover .link-delete {
  opacity: 1;
}

.link-delete:hover {
  background: var(--accent-soft);
  color: var(--accent-color);
}
</style>
