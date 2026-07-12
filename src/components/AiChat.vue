<script setup lang="ts">
import { ref, nextTick, inject, onBeforeUnmount, onMounted, type Ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  streamChat,
  loadConfig,
  saveConfig,
  testConnection,
  PRESETS,
  type ChatMessage,
  type LlmConfig,
} from '../services/llm'
import { loadStickyStore, type StickyStore } from '../services/stickyStore'
import { createNote, loadNotes, persistNotes } from '../services/notesStore'
import { addTodo } from '../services/todoStore'

marked.setOptions({ breaks: true, gfm: true })

const memo = inject<Ref<string>>('memo')

interface DisplayMsg {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  stopped?: boolean
}

const messages = ref<DisplayMsg[]>([])
const input = ref('')
const streaming = ref(false)
const showSettings = ref(false)
const messagesEl = ref<HTMLDivElement>()
const inputEl = ref<HTMLInputElement>()
const editingIndex = ref<number | null>(null)
const connectionTesting = ref(false)
const connectionResult = ref('')
const connectionOk = ref(false)
const actionNotice = ref('')

const config = ref<LlmConfig>({ baseUrl: '', apiKey: '', model: '' })

let store: StickyStore | null = null
let lastSystemPrompt: string | null = null
let abortController: AbortController | null = null
let activeReplyIndex: number | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  const c = await loadConfig()
  config.value = { ...c }
  if (!c.baseUrl.trim() || !c.apiKey.trim() || !c.model.trim()) showSettings.value = true
  store = await loadStickyStore()
  const saved = await store.get<DisplayMsg[]>('aiChatHistory')
  if (saved && Array.isArray(saved)) {
    messages.value = saved
    scrollToBottom()
  }
})

onBeforeUnmount(() => {
  if (streaming.value) stopGeneration()
  else void saveHistory()
  if (noticeTimer) clearTimeout(noticeTimer)
})

async function saveHistory() {
  try {
    await store?.set('aiChatHistory', messages.value.map(message => ({ ...message })))
  } catch (error) {
    console.warn('AI 对话记录保存失败', error)
  }
}

function renderMd(content: string): string {
  return DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

async function send(text?: string, systemPrompt?: string) {
  const content = (text ?? input.value).trim()
  if (!content || streaming.value) return

  input.value = ''
  if (text === undefined && editingIndex.value !== null) {
    messages.value = messages.value.slice(0, editingIndex.value)
    editingIndex.value = null
  }
  messages.value.push({ role: 'user', content })
  lastSystemPrompt = systemPrompt || null
  await streamToReply()
}

// 以当前消息记录为上下文请求回复；重试时复用
async function streamToReply() {
  const history: ChatMessage[] = messages.value
    .filter(m => !m.error)
    .map(m => ({ role: m.role, content: m.content }))

  const replyIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  streaming.value = true
  activeReplyIndex = replyIndex
  abortController = new AbortController()
  scrollToBottom()

  await streamChat(
    history,
    lastSystemPrompt,
    {
      onChunk: (chunk) => {
        if (activeReplyIndex !== replyIndex) return
        messages.value[replyIndex].content += chunk
        scrollToBottom()
      },
      onDone: () => finishStream(replyIndex),
      onAbort: () => finishStream(replyIndex, true),
      onError: (err) => {
        if (activeReplyIndex !== replyIndex) return
        const reply = messages.value[replyIndex]
        reply.content = err
        reply.error = true
        finishStream(replyIndex)
      },
    },
    abortController.signal,
  )
}

function finishStream(replyIndex: number, stopped = false) {
  if (activeReplyIndex !== replyIndex) return
  const reply = messages.value[replyIndex]
  if (reply && stopped) reply.stopped = true
  streaming.value = false
  activeReplyIndex = null
  abortController = null
  void saveHistory()
}

function stopGeneration(persist = true) {
  if (!streaming.value || activeReplyIndex === null) return
  const reply = messages.value[activeReplyIndex]
  if (reply) reply.stopped = true
  const controller = abortController
  streaming.value = false
  activeReplyIndex = null
  abortController = null
  controller?.abort()
  if (persist) void saveHistory()
}

async function retry() {
  if (streaming.value) return
  const last = messages.value[messages.value.length - 1]
  if (!last || last.role !== 'assistant') return
  messages.value.pop()
  await streamToReply()
}

function beginEdit(index: number) {
  if (streaming.value || messages.value[index]?.role !== 'user') return
  editingIndex.value = index
  input.value = messages.value[index].content
  nextTick(() => inputEl.value?.focus())
}

function cancelEdit() {
  editingIndex.value = null
  input.value = ''
}

function usePreset(key: string) {
  const prompt = PRESETS[key]
  const memoText = memo?.value || ''
  if (!memoText && (key === 'polish' || key === 'translate' || key === 'summarize')) {
    send(`${prompt}\n(备忘为空，请先在备忘标签页写点内容)`)
    return
  }
  send(`${prompt}\n\n${memoText}`, '你是一个简洁高效的写作助手。')
}

function clearChat() {
  if (messages.value.length && !window.confirm('清空全部 AI 对话记录？此操作无法撤销。')) return
  stopGeneration(false)
  messages.value = []
  editingIndex.value = null
  void saveHistory()
}

async function saveSettings() {
  try {
    await saveConfig(config.value)
    showSettings.value = false
    showNotice('设置已保存')
  } catch (error) {
    console.warn('AI 设置保存失败', error)
    showNotice('设置保存失败')
  }
}

async function checkConnection() {
  if (connectionTesting.value) return
  connectionTesting.value = true
  connectionResult.value = ''
  connectionOk.value = false
  try {
    connectionResult.value = await testConnection(config.value)
    connectionOk.value = true
  } catch (error) {
    connectionResult.value = error instanceof Error ? error.message : String(error)
  } finally {
    connectionTesting.value = false
  }
}

async function saveAsNote(content: string) {
  const text = content.trim()
  if (!text) return
  try {
    await loadNotes()
    const note = createNote()
    note.text = text
    note.updatedAt = Date.now()
    await persistNotes()
    showNotice('已保存到便签')
  } catch (error) {
    console.warn('AI 回复保存到便签失败', error)
    showNotice('保存便签失败')
  }
}

async function saveAsTodos(content: string) {
  const items = extractTodoItems(content)
  if (!items.length) return
  try {
    let added = 0
    for (const text of items) {
      if (await addTodo(text)) added += 1
    }
    showNotice(`已添加 ${added} 条待办`)
  } catch (error) {
    console.warn('AI 回复转换待办失败', error)
    showNotice('添加待办失败')
  }
}

function extractTodoItems(content: string): string[] {
  const listItems = content
    .split(/\r?\n/)
    .map(line => line.match(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)(.+)$/)?.[1]?.trim() || '')
    .filter(Boolean)
    .slice(0, 20)

  if (listItems.length) return listItems.map(text => text.slice(0, 500))
  const plain = content.replace(/[#*_`>]/g, '').trim()
  return plain ? [plain.slice(0, 500)] : []
}

function showNotice(message: string) {
  actionNotice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { actionNotice.value = '' }, 1800)
}
</script>

<template>
  <div class="ai-chat">
    <div class="ai-actions">
      <button class="chip" :disabled="streaming" @click="usePreset('polish')">润色</button>
      <button class="chip" :disabled="streaming" @click="usePreset('translate')">翻译</button>
      <button class="chip" :disabled="streaming" @click="usePreset('summarize')">总结</button>
      <button class="chip" :disabled="streaming" @click="usePreset('organize')">整理</button>
      <button class="chip chip-util" @click="clearChat" title="清空对话">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      </button>
      <button class="chip chip-util" @click="showSettings = !showSettings" title="设置">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </button>
    </div>

    <div v-if="showSettings" class="settings-panel">
      <label>
        <span>Base URL</span>
        <input v-model="config.baseUrl" placeholder="https://api.anthropic.com" />
      </label>
      <label>
        <span>API Key</span>
        <input v-model="config.apiKey" type="password" placeholder="sk-..." />
        <small>密钥仅保存在当前设备；网页版直连接口时仍会由浏览器发送。</small>
      </label>
      <label>
        <span>Model</span>
        <input v-model="config.model" placeholder="claude-opus-4-6" />
      </label>
      <div class="settings-actions">
        <button class="test-btn" :disabled="connectionTesting" @click="checkConnection">
          {{ connectionTesting ? '测试中…' : '测试连接' }}
        </button>
        <button class="save-btn" @click="saveSettings">保存</button>
      </div>
      <p v-if="connectionResult" class="connection-result" :class="{ ok: connectionOk }">
        {{ connectionResult }}
      </p>
    </div>

    <div v-else ref="messagesEl" class="messages">
      <div v-if="messages.length === 0" class="empty-hint">
        输入消息或点击上方快捷操作
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        :class="['msg', msg.role, { error: msg.error }]"
      >
        <div v-if="msg.role === 'assistant' && !msg.error" class="msg-bubble md" v-html="renderMd(msg.content || '…')" />
        <div v-else class="msg-bubble">{{ msg.content }}</div>
        <span v-if="streaming && i === messages.length - 1 && msg.role === 'assistant'" class="cursor">|</span>
        <div v-if="!streaming || i !== messages.length - 1" class="msg-actions">
          <button v-if="msg.role === 'user'" @click="beginEdit(i)">编辑重发</button>
          <template v-else-if="msg.content">
            <span v-if="msg.stopped" class="stopped-label">已停止</span>
            <button v-if="!msg.error" @click="saveAsNote(msg.content)">存便签</button>
            <button v-if="!msg.error" @click="saveAsTodos(msg.content)">转待办</button>
            <button v-if="i === messages.length - 1" @click="retry">重试</button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="editingIndex !== null" class="edit-banner">
      <span>编辑后发送会替换这条消息之后的对话</span>
      <button @click="cancelEdit">取消</button>
    </div>
    <div class="input-row">
      <input
        ref="inputEl"
        v-model="input"
        class="chat-input"
        :placeholder="editingIndex === null ? '问点什么…' : '修改消息后重新发送…'"
        :disabled="streaming"
        @keydown.enter="send()"
      />
      <button v-if="streaming" class="send-btn stop-btn" title="停止生成" @click="stopGeneration()">
        <span />
      </button>
      <button v-else class="send-btn" :disabled="!input.trim()" @click="send()">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
    <transition name="notice">
      <div v-if="actionNotice" class="action-notice">{{ actionNotice }}</div>
    </transition>
  </div>
</template>

<style scoped>
.ai-chat {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-2);
}

.ai-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: none;
}

.chip {
  padding: 5px 12px;
  border: none;
  border-radius: 999px;
  background: var(--surface-color);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-color);
  cursor: pointer;
  box-shadow: var(--shadow-raised);
  transition: transform 0.15s ease;
  font-family: inherit;
}

.chip:hover {
  transform: translateY(-1px);
}

.chip:disabled {
  opacity: 0.45;
  cursor: default;
  transform: none;
}

.chip:active {
  box-shadow: var(--shadow-pressed);
  transform: none;
}

.chip-util {
  color: var(--ink-3);
  padding: 5px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-util:first-of-type {
  margin-left: auto;
}

.chip-util svg {
  width: 12px;
  height: 12px;
}

.settings-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--surface-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-raised);
  padding: var(--space-4);
  overflow-y: auto;
}

.settings-panel label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-panel label span {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-3);
  letter-spacing: 0.3px;
}

.settings-panel label small {
  color: var(--ink-3);
  font-size: 10px;
  line-height: 1.45;
}

.settings-panel input {
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
  color: var(--ink-1);
}

.settings-panel input:focus {
  box-shadow: var(--shadow-pressed), 0 0 0 2px var(--accent-soft);
}

.settings-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.save-btn,
.test-btn {
  padding: 7px 18px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent-color);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 10px var(--accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease;
}

.test-btn {
  color: var(--accent-color);
  background: var(--surface-color);
  box-shadow: var(--shadow-raised);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.connection-result {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: #a64242;
  background: rgba(185, 58, 58, 0.08);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.connection-result.ok {
  color: #24734f;
  background: rgba(47, 179, 122, 0.1);
}

.save-btn:hover {
  transform: translateY(-1px);
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  font-size: 13px;
}

.msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.msg.user {
  align-items: flex-end;
}

.msg.error {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.msg.error .msg-bubble {
  color: var(--accent-color);
  background: var(--accent-soft);
  box-shadow: none;
  font-weight: 600;
}

.msg-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 16px;
}

.msg-actions button {
  border: none;
  padding: 1px 2px;
  font-size: 10px;
  font-weight: 700;
  font-family: inherit;
  color: var(--ink-3);
  background: transparent;
  cursor: pointer;
  transition: color 0.15s ease;
}

.msg-actions button:hover {
  color: var(--accent-color);
}

.stopped-label {
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
}

.msg-bubble {
  max-width: 85%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  user-select: text;
}

.user .msg-bubble {
  background: var(--accent-color);
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 10px var(--accent-soft), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.assistant .msg-bubble {
  background: var(--surface-color);
  color: var(--ink-1);
  border-bottom-left-radius: 4px;
  box-shadow: var(--shadow-raised);
}

/* markdown 渲染内容 */
.md {
  white-space: normal;
}

.md :deep(p) {
  margin: 0 0 var(--space-2);
}

.md :deep(p:last-child) {
  margin-bottom: 0;
}

.md :deep(ul),
.md :deep(ol) {
  margin: 0 0 var(--space-2);
  padding-left: var(--space-5);
}

.md :deep(li) {
  margin: 2px 0;
}

.md :deep(code) {
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: 11.5px;
  background: var(--tint-color);
  padding: 1px 5px;
  border-radius: 5px;
}

.md :deep(pre) {
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  overflow-x: auto;
  margin: 0 0 var(--space-2);
}

.md :deep(pre code) {
  background: none;
  padding: 0;
}

.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4) {
  font-size: 13px;
  font-weight: 800;
  margin: var(--space-2) 0 var(--space-1);
}

.md :deep(blockquote) {
  border-left: 3px solid var(--accent-soft);
  padding-left: var(--space-3);
  color: var(--ink-2);
  margin: 0 0 var(--space-2);
}

.md :deep(a) {
  color: var(--accent-color);
}

.md :deep(table) {
  border-collapse: collapse;
  margin: 0 0 var(--space-2);
  font-size: 12px;
}

.md :deep(th),
.md :deep(td) {
  border: 1px solid var(--line);
  padding: 3px 8px;
}

.cursor {
  animation: blink 0.8s infinite;
  color: var(--accent-color);
  font-weight: 300;
}

.edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--ink-2);
  font-size: 10.5px;
  font-weight: 600;
}

.edit-banner button {
  flex: none;
  border: 0;
  padding: 2px 4px;
  color: var(--accent-color);
  background: transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.input-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  box-shadow: var(--shadow-raised);
  flex: none;
}

.chat-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: var(--ink-1);
}

.chat-input::placeholder {
  color: var(--ink-3);
}

.send-btn {
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

.send-btn svg {
  width: 14px;
  height: 14px;
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.send-btn:not(:disabled):hover {
  transform: translateY(-1px);
}

.stop-btn span {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: currentColor;
}

.action-notice {
  position: absolute;
  left: 50%;
  bottom: 48px;
  z-index: 5;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 999px;
  color: #fff;
  background: rgba(43, 38, 33, 0.88);
  box-shadow: 0 5px 16px rgba(43, 38, 33, 0.16);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>
