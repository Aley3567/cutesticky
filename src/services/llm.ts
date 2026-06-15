import { fetch } from '@tauri-apps/plugin-http'
import { load } from '@tauri-apps/plugin-store'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_CONFIG: LlmConfig = {
  baseUrl: 'https://api.vectorengine.ai',
  apiKey: '',
  model: 'claude-opus-4-6',
}

let cachedConfig: LlmConfig | null = null

export async function loadConfig(): Promise<LlmConfig> {
  if (cachedConfig) return cachedConfig
  const store = await load('sticky-data.json', { autoSave: true, defaults: {} })
  const saved = await store.get<LlmConfig>('llmConfig')
  cachedConfig = saved ? { ...DEFAULT_CONFIG, ...saved } : { ...DEFAULT_CONFIG }
  return cachedConfig
}

export async function saveConfig(config: LlmConfig): Promise<void> {
  const store = await load('sticky-data.json', { autoSave: true, defaults: {} })
  await store.set('llmConfig', config)
  cachedConfig = config
}

export const PRESETS: Record<string, string> = {
  polish: '请润色以下文字，保持原意但让表达更流畅自然。直接输出润色后的文字，不要加额外解释：',
  translate: '请将以下文字翻译为英文。直接输出翻译结果：',
  summarize: '请用简洁的语言总结以下内容的要点：',
  organize: '请将以下内容整理成清晰的待办清单，每项一行，用"- "开头：',
}

export async function streamChat(
  messages: ChatMessage[],
  systemPrompt: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const config = await loadConfig()
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '')
  const model = config.model.trim()
  const apiKey = config.apiKey.trim()

  if (!baseUrl) {
    onError('请先在设置中填写 Base URL')
    return
  }
  if (!apiKey) {
    onError('请先在设置中填写 API Key')
    return
  }
  if (!model) {
    onError('请先在设置中填写 Model')
    return
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    stream: true,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      onError(`API 错误 ${response.status}: ${errText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError('无法读取响应流')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data) continue

        try {
          const event = JSON.parse(data)
          if (event.type === 'content_block_delta' && event.delta?.text) {
            onChunk(event.delta.text)
          } else if (event.type === 'error') {
            onError(event.error?.message || '流式响应错误')
            return
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    onDone()
  } catch (err) {
    onError(`请求失败: ${err}`)
  }
}
