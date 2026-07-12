<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch, provide, type Component } from 'vue'
import NotesView from './components/NotesView.vue'
import TodoList from './components/TodoList.vue'
import LinkList from './components/LinkList.vue'
import AiChat from './components/AiChat.vue'
import GameArcade from './components/GameArcade.vue'
import PomodoroTimer from './components/PomodoroTimer.vue'
import WeatherView from './components/WeatherView.vue'
import DataBackup from './components/DataBackup.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import { loadStickyStore, type StickyStore } from './services/stickyStore'
import { notes, persistNotes } from './services/notesStore'
import { initializePomodoro } from './services/pomodoroStore'
import { closeAppWindow, hideAppWindow, isWebRuntime } from './platform'
import { checkForUpdates, updateState } from './services/updateService'

// 每套主题四个变量整体染色：强调色 / 强调浅底 / 卡片面 / 染色底
const themes = [
  { name: '蜜桃', accent: '#FF8C55', accentSoft: 'rgba(255, 140, 85, 0.16)', surface: '#FFFDFB', tint: '#FFF1E8' },
  { name: '薄荷', accent: '#2FB37A', accentSoft: 'rgba(47, 179, 122, 0.16)', surface: '#FCFEFC', tint: '#E9F8F0' },
  { name: '天空', accent: '#4C8FDB', accentSoft: 'rgba(76, 143, 219, 0.16)', surface: '#FCFDFF', tint: '#E9F2FD' },
  { name: '紫藤', accent: '#9C76BD', accentSoft: 'rgba(156, 118, 189, 0.16)', surface: '#FDFCFF', tint: '#F2ECFA' },
  { name: '樱花', accent: '#E87E95', accentSoft: 'rgba(232, 126, 149, 0.16)', surface: '#FFFCFD', tint: '#FCEBEF' },
]

type TabType = 'memo' | 'todo' | 'pomodoro' | 'weather' | 'game' | 'ai' | 'links'

const TABS: { key: TabType; icon: string; viewBox: string; label: string }[] = [
  { key: 'memo', label: '备忘', viewBox: '0 0 24 24',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { key: 'todo', label: '待办', viewBox: '0 0 24 24',
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { key: 'pomodoro', label: '番茄', viewBox: '0 0 24 24',
    icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2M10 1h4' },
  { key: 'weather', label: '天气', viewBox: '0 0 24 24',
    icon: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' },
  { key: 'game', label: '游戏', viewBox: '0 0 24 24',
    icon: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.214 12.18 2 16.12 2 17a3 3 0 0 0 6 0l1-3h6l1 3a3 3 0 0 0 6 0c0-.88-.214-4.82-.702-8.41A4 4 0 0 0 17.32 5z' },
  { key: 'ai', label: 'AI', viewBox: '0 0 24 24',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z' },
  { key: 'links', label: '常用', viewBox: '0 0 24 24',
    icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
]

const activeTab = ref<TabType>('memo')
const themeIndex = ref(0)
const showDataBackup = ref(false)
const theme = computed(() => themes[themeIndex.value])
const shortcutModifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

const VIEWS: Record<Exclude<TabType, 'game'>, Component> = {
  memo: NotesView,
  todo: TodoList,
  pomodoro: PomodoroTimer,
  weather: WeatherView,
  ai: AiChat,
  links: LinkList,
}

const activeView = computed(() => activeTab.value === 'game' ? null : VIEWS[activeTab.value])

// AI 快捷指令读取全部便签内容
provide('memo', computed(() => notes.value.map(n => n.text).filter(t => t.trim()).join('\n\n')))

let store: StickyStore | null = null

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void initializePomodoro()
  store = await loadStickyStore()

  const saved = await store.get<number>('themeIndex')
  if (saved !== null && saved !== undefined && saved < themes.length) themeIndex.value = saved

  const savedTab = await store.get<string>('activeTab')
  if (savedTab && TABS.some(t => t.key === savedTab)) activeTab.value = savedTab as TabType
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(themeIndex, async (i) => { await store?.set('themeIndex', i) })
watch(activeTab, async (tab) => { await store?.set('activeTab', tab) })

async function closeWindow() {
  await persistNotes()
  await closeAppWindow()
}

async function hideToTray() {
  await hideAppWindow()
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showDataBackup.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    showDataBackup.value = false
    return
  }

  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  const index = Number(event.key) - 1
  const tab = TABS[index]
  if (!tab) return
  event.preventDefault()
  activeTab.value = tab.key
}
</script>

<template>
  <div
    class="app-shell"
    :style="{
      '--accent-color': theme.accent,
      '--accent-soft': theme.accentSoft,
      '--surface-color': theme.surface,
      '--tint-color': theme.tint,
    }"
  >
    <!-- Titlebar -->
    <div class="titlebar" data-tauri-drag-region>
      <span class="brand" data-tauri-drag-region>
        <svg class="brand-heart" viewBox="0 0 24 24" fill="none" :stroke="theme.accent" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>
          <path d="M14 3v5h5M8 14l2.2 2.2L15 11.5"/>
        </svg>
        cute sticky
      </span>
      <span class="tb-theme">
        <button
          v-for="(t, i) in themes"
          :key="t.name"
          class="theme-dot"
          :class="{ sel: themeIndex === i }"
          :style="{ background: t.accent }"
          :title="t.name"
          @click="themeIndex = i"
        />
      </span>
      <span class="tb-actions">
        <button
          v-if="!isWebRuntime"
          class="tb-btn update-button"
          :class="{ 'has-update': updateState.phase === 'available' }"
          :disabled="updateState.phase === 'checking' || updateState.phase === 'downloading' || updateState.phase === 'installing'"
          title="检查更新"
          aria-label="检查应用更新"
          @click="checkForUpdates(true)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>
          </svg>
        </button>
        <button v-if="activeTab !== 'game'" class="tb-btn" @click="showDataBackup = true" title="本地数据" aria-label="打开本地数据备份">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h16M6 3h12l2 4v13H4V7l2-4Z"/><path d="M8 12h8M8 16h5"/>
          </svg>
        </button>
        <template v-if="!isWebRuntime">
        <button class="tb-btn" @click="hideToTray" title="隐藏">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
            <path d="M5 12h14"/>
          </svg>
        </button>
        <button class="tb-btn close" @click="closeWindow" title="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        </template>
      </span>
    </div>

    <!-- Tab bar -->
    <div class="tabbar">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
        :title="`${tab.label} · ${shortcutModifier}${TABS.indexOf(tab) + 1}`"
        :aria-label="tab.label"
        :aria-pressed="activeTab === tab.key"
      >
        <svg :viewBox="tab.viewBox" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path :d="tab.icon" />
        </svg>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="content" :class="{ 'game-content': activeTab === 'game' }">
      <Transition name="tab-fade" mode="out-in">
        <GameArcade v-if="activeTab === 'game'" key="game" />
        <KeepAlive v-else>
          <component :is="activeView" :key="activeTab" />
        </KeepAlive>
      </Transition>
    </div>

    <div v-if="showDataBackup" class="data-backdrop" role="presentation" @click.self="showDataBackup = false">
      <div class="data-dialog" role="dialog" aria-modal="true" aria-label="本地数据">
        <button class="dialog-close" title="关闭" aria-label="关闭本地数据" @click="showDataBackup = false">×</button>
        <DataBackup />
      </div>
    </div>
    <UpdatePrompt v-if="!isWebRuntime" />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  background-image: linear-gradient(180deg, var(--tint-color) 0%, var(--surface-color) 34%);
  box-shadow:
    0 10px 28px rgba(43, 38, 33, 0.20),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* Titlebar */
.titlebar {
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  cursor: grab;
}

.brand {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: var(--ink-1);
  display: flex;
  align-items: center;
}

.brand-heart {
  width: 13px;
  height: 13px;
  margin-right: 5px;
  pointer-events: none;
}

.tb-theme {
  display: flex;
  gap: 6px;
  margin-left: var(--space-3);
}

.theme-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(43, 38, 33, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transition: transform 0.15s ease;
}

.theme-dot.sel {
  outline: 2px solid rgba(43, 38, 33, 0.18);
  outline-offset: 2px;
}

.theme-dot:hover:not(.sel) {
  transform: scale(1.2);
}

.tb-actions {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}

.tb-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  background: var(--cream);
  color: var(--ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-raised);
  transition: transform 0.15s ease;
}

.tb-btn svg {
  width: 11px;
  height: 11px;
}

.tb-btn:hover {
  transform: translateY(-1px);
}

.tb-btn:active {
  box-shadow: var(--shadow-pressed);
  transform: none;
}

.tb-btn.close {
  color: var(--accent-color);
}

.tb-btn:disabled {
  cursor: wait;
  opacity: 0.55;
  transform: none;
}

.update-button {
  position: relative;
}

.update-button.has-update::after {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border: 2px solid var(--surface-color);
  border-radius: 50%;
  background: var(--accent-color);
  content: '';
}

/* Tab bar：pressed 凹槽里放 7 个 tab，激活项浮起 */
.tabbar {
  flex: none;
  margin: var(--space-1) var(--space-3) var(--space-3);
  padding: var(--space-1);
  background: var(--tint-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pressed);
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.tab {
  height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--ink-3);
  transition: color 0.2s ease;
}

.tab svg {
  width: 18px;
  height: 18px;
}

.tab span {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.tab:not(.active):hover {
  color: var(--ink-2);
}

.tab.active {
  background: var(--surface-color);
  color: var(--accent-color);
  box-shadow: var(--shadow-raised);
}

/* Content */
.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-2) var(--space-4) var(--space-4);
}

.content.game-content {
  overflow: hidden;
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.data-backdrop {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(52, 43, 36, 0.22);
  backdrop-filter: blur(5px);
}

.data-dialog {
  position: relative;
  width: 100%;
  max-width: 328px;
}

.dialog-close {
  position: absolute;
  z-index: 1;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 8px;
  color: var(--ink-2);
  background: var(--tint-color);
  font: 700 18px/1 var(--font);
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .tab-fade-enter-active,
  .tab-fade-leave-active {
    transition: none;
  }
}
</style>
