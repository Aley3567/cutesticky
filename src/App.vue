<script setup lang="ts">
import { ref, computed, onMounted, watch, provide } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { load } from '@tauri-apps/plugin-store'
import MemoArea from './components/MemoArea.vue'
import TodoList from './components/TodoList.vue'
import LinkList from './components/LinkList.vue'
import AiChat from './components/AiChat.vue'

const themes = [
  { name: '橘子', header: '#FF9843', bg: '#FFF8F0', shadow: 'rgba(255,152,67,0.3)' },
  { name: '薄荷', header: '#5CC8A8', bg: '#F0FFF8', shadow: 'rgba(92,200,168,0.3)' },
  { name: '蓝莓', header: '#6C9BCF', bg: '#F0F5FF', shadow: 'rgba(108,155,207,0.3)' },
  { name: '葡萄', header: '#B07CC6', bg: '#F8F0FF', shadow: 'rgba(176,124,198,0.3)' },
  { name: '草莓', header: '#FF6B81', bg: '#FFF0F3', shadow: 'rgba(255,107,129,0.3)' },
]

type TabType = 'memo' | 'todo' | 'links' | 'ai'

const activeTab = ref<TabType>('memo')
const themeIndex = ref(0)
const theme = ref(themes[0])
const showLinks = ref(false)
const memoText = ref('')

provide('memo', memoText)

const tabs = computed(() => {
  const base: { key: TabType; label: string }[] = [
    { key: 'memo', label: '备忘' },
    { key: 'todo', label: '待办' },
    { key: 'ai', label: 'AI' },
  ]
  if (showLinks.value) {
    base.push({ key: 'links', label: '常用' })
  }
  return base
})

const activeTabIndex = computed(() => {
  return tabs.value.findIndex(t => t.key === activeTab.value)
})

let store: Awaited<ReturnType<typeof load>> | null = null
let memoSaveTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  store = await load('sticky-data.json', { autoSave: true, defaults: {} })
  const savedMemo = await store.get<string>('memo')
  if (savedMemo) {
    memoText.value = savedMemo
  }
  const saved = await store.get<number>('themeIndex')
  if (saved !== null && saved !== undefined) {
    themeIndex.value = saved
    theme.value = themes[saved]
  }
  const savedTab = await store.get<string>('activeTab')
  if (savedTab === 'memo' || savedTab === 'todo' || savedTab === 'links' || savedTab === 'ai') {
    activeTab.value = savedTab
  }
  const savedShowLinks = await store.get<boolean>('showLinks')
  if (savedShowLinks !== null && savedShowLinks !== undefined) {
    showLinks.value = savedShowLinks
  }
  if (!showLinks.value && activeTab.value === 'links') {
    activeTab.value = 'memo'
  }
})

watch(themeIndex, async (i) => {
  theme.value = themes[i]
  await store?.set('themeIndex', i)
})

watch(activeTab, async (tab) => {
  await store?.set('activeTab', tab)
})

watch(showLinks, async (val) => {
  await store?.set('showLinks', val)
  if (!val && activeTab.value === 'links') {
    activeTab.value = 'memo'
  }
})

watch(memoText, (text) => {
  if (memoSaveTimer) clearTimeout(memoSaveTimer)
  memoSaveTimer = setTimeout(async () => {
    await store?.set('memo', text)
  }, 500)
})

function selectTheme(i: number) {
  themeIndex.value = i
}

function toggleLinks() {
  showLinks.value = !showLinks.value
}

async function closeWindow() {
  await getCurrentWindow().close()
}
</script>

<template>
  <div
    class="sticky-container"
    :style="{
      '--header-color': theme.header,
      '--bg-color': theme.bg,
      '--shadow-color': theme.shadow,
    }"
  >
    <div class="titlebar" data-tauri-drag-region>
      <svg class="titlebar-icon" data-tauri-drag-region width="20" height="20" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="orangeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#FFD180"/>
            <stop offset="50%" stop-color="#FF9843"/>
            <stop offset="100%" stop-color="#E8751A"/>
          </radialGradient>
          <radialGradient id="highlight" cx="35%" cy="25%" r="30%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.6)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="55" r="40" fill="url(#orangeGrad)"/>
        <circle cx="50" cy="55" r="40" fill="url(#highlight)"/>
        <path d="M50 18 Q58 8 65 15 Q58 22 50 18Z" fill="#4CAF50"/>
        <path d="M50 18 Q42 10 38 18 Q44 22 50 18Z" fill="#66BB6A"/>
        <rect x="48" y="12" width="4" height="10" rx="2" fill="#795548"/>
      </svg>
      <span class="titlebar-text" data-tauri-drag-region>cute sticky</span>
      <button
        class="titlebar-btn"
        :class="{ 'link-active': showLinks }"
        @click="toggleLinks"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </button>
      <button class="titlebar-btn close-btn" @click="closeWindow">×</button>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
      <div
        class="tab-indicator"
        :style="{
          width: 'calc((100% - 32px) / ' + tabs.length + ')',
          transform: 'translateX(' + (activeTabIndex * 100) + '%)',
        }"
      />
    </div>

    <div class="content">
      <MemoArea v-if="activeTab === 'memo'" v-model="memoText" />
      <TodoList v-else-if="activeTab === 'todo'" />
      <AiChat v-else-if="activeTab === 'ai'" />
      <LinkList v-else-if="activeTab === 'links'" />
    </div>

    <div class="theme-zone">
      <div class="theme-bar">
        <button
          v-for="(t, i) in themes"
          :key="t.name"
          class="theme-dot"
          :class="{ active: themeIndex === i }"
          :style="{ background: t.header }"
          :title="t.name"
          @click="selectTheme(i)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sticky-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  overflow: hidden;
  background: var(--bg-color);
  box-shadow: 0 8px 32px var(--shadow-color);
}

.titlebar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--header-color);
  cursor: grab;
  min-height: 42px;
  gap: 6px;
}

.titlebar-icon {
  flex-shrink: 0;
}

.titlebar-text {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.5px;
}

.titlebar-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  line-height: 1;
  flex-shrink: 0;
}

.titlebar-btn:hover {
  background: rgba(255, 255, 255, 0.45);
}

.titlebar-btn.link-active {
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
}

.close-btn {
  margin-left: 4px;
}

.tabs {
  display: flex;
  padding: 8px 16px 0;
  position: relative;
}

.tab {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #aaa;
  cursor: pointer;
  transition: color 0.2s ease;
  font-family: inherit;
  position: relative;
  z-index: 1;
}

.tab.active {
  color: var(--header-color);
}

.tab:not(.active):hover {
  color: #888;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 16px;
  height: 3px;
  border-radius: 2px;
  background: var(--header-color);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.theme-zone {
  position: relative;
  height: 40px;
  flex-shrink: 0;
}

.theme-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.theme-zone:hover .theme-bar {
  opacity: 1;
  pointer-events: auto;
}

.theme-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-dot.active {
  border-color: white;
  box-shadow: 0 0 0 2px var(--header-color);
  animation: dotBounce 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-dot:hover:not(.active) {
  transform: scale(1.2);
}

@keyframes dotBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
</style>
