<script setup lang="ts">
import { ref, nextTick, inject, onMounted, type Ref } from 'vue'
import { streamChat, loadConfig, saveConfig, PRESETS, type ChatMessage, type LlmConfig } from '../services/llm'

const memo = inject<Ref<string>>('memo')

interface DisplayMsg {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<DisplayMsg[]>([])
const input = ref('')
const streaming = ref(false)
const showSettings = ref(false)
const messagesEl = ref<HTMLDivElement>()

const config = ref<LlmConfig>({ baseUrl: '', apiKey: '', model: '' })

onMounted(async () => {
  const c = await loadConfig()
  config.value = { ...c }
})

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

async function send(text?: string, systemPrompt?: string) {
  const content = text || input.value.trim()
  if (!content || streaming.value) return

  input.value = ''
  messages.value.push({ role: 'user', content })
  messages.value.push({ role: 'assistant', content: '' })
  streaming.value = true
  scrollToBottom()

  const history: ChatMessage[] = messages.value
    .slice(0, -1)
    .map(m => ({ role: m.role, content: m.content }))

  await streamChat(
    history,
    systemPrompt || null,
    (chunk) => {
      messages.value[messages.value.length - 1].content += chunk
      scrollToBottom()
    },
    () => {
      streaming.value = false
    },
    (err) => {
      messages.value[messages.value.length - 1].content = `[错误] ${err}`
      streaming.value = false
    },
  )
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
  messages.value = []
}

async function saveSettings() {
  await saveConfig(config.value)
  showSettings.value = false
}
</script>

<template>
  <div class="ai-chat">
    <div class="ai-actions">
      <button class="chip" @click="usePreset('polish')">润色</button>
      <button class="chip" @click="usePreset('translate')">翻译</button>
      <button class="chip" @click="usePreset('summarize')">总结</button>
      <button class="chip" @click="usePreset('organize')">整理</button>
      <button class="chip chip-util" @click="clearChat" title="清空对话">C</button>
      <button class="chip chip-util" @click="showSettings = !showSettings" title="设置">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </button>
    </div>

    <div v-if="showSettings" class="settings-panel">
      <label>
        <span>Base URL</span>
        <input v-model="config.baseUrl" placeholder="https://muyuan.do" />
      </label>
      <label>
        <span>API Key</span>
        <input v-model="config.apiKey" type="password" placeholder="sk-..." />
      </label>
      <label>
        <span>Model</span>
        <input v-model="config.model" placeholder="claude-opus-4-6" />
      </label>
      <button class="save-btn" @click="saveSettings">保存</button>
    </div>

    <div v-else ref="messagesEl" class="messages">
      <div v-if="messages.length === 0" class="empty-hint">
        输入消息或点击上方快捷操作
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        :class="['msg', msg.role]"
      >
        <div class="msg-bubble">{{ msg.content }}<span v-if="streaming && i === messages.length - 1 && msg.role === 'assistant'" class="cursor">|</span></div>
      </div>
    </div>

    <div class="input-row">
      <input
        v-model="input"
        class="chat-input"
        placeholder="问点什么..."
        :disabled="streaming"
        @keydown.enter="send()"
      />
      <button class="send-btn" :disabled="streaming || !input.trim()" @click="send()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.ai-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  padding: 4px 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
  font-size: 12px;
  font-weight: 600;
  color: var(--header-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.chip:hover {
  background: color-mix(in srgb, var(--header-color) 10%, transparent);
}

.chip-util {
  color: #aaa;
  margin-left: auto;
  padding: 4px 7px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-util:first-of-type {
  margin-left: auto;
}

.chip-util + .chip-util {
  margin-left: 0;
}

.settings-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
  overflow-y: auto;
}

.settings-panel label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.settings-panel label span {
  font-size: 11px;
  font-weight: 600;
  color: #999;
}

.settings-panel input {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: rgba(0, 0, 0, 0.02);
  color: #555;
}

.settings-panel input:focus {
  border-color: var(--header-color);
}

.save-btn {
  align-self: flex-end;
  padding: 5px 16px;
  border: none;
  border-radius: 8px;
  background: var(--header-color);
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}

.save-btn:hover {
  opacity: 0.85;
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 13px;
}

.msg {
  display: flex;
}

.msg.user {
  justify-content: flex-end;
}

.msg-bubble {
  max-width: 85%;
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  user-select: text;
}

.user .msg-bubble {
  background: var(--header-color);
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant .msg-bubble {
  background: rgba(0, 0, 0, 0.04);
  color: #444;
  border-bottom-left-radius: 4px;
}

.cursor {
  animation: blink 0.8s infinite;
  color: var(--header-color);
  font-weight: 300;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.input-row {
  display: flex;
  gap: 6px;
  align-items: center;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  padding-top: 8px;
}

.chat-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: #555;
  padding: 4px 0;
}

.chat-input::placeholder {
  color: #ccc;
}

.send-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--header-color);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.send-btn:not(:disabled):hover {
  transform: scale(1.1);
}
</style>
