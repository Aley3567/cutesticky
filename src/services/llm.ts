import { loadStickyStore } from './stickyStore'
import { isDesktopRuntime, platformFetch } from '../platform'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamChatCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: string) => void
  onAbort?: () => void
}

const MAX_CONTEXT_MESSAGES = 24
const MAX_CONTEXT_CHARS = 24_000

// Base URL 不预设第三方端点，由用户在设置中自行填写
const DEFAULT_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  model: 'claude-opus-4-6',
}

let cachedConfig: LlmConfig | null = null

export async function loadConfig(): Promise<LlmConfig> {
  if (cachedConfig) return cachedConfig
  const store = await loadStickyStore()
  const saved = await store.get<LlmConfig>('llmConfig')
  cachedConfig = saved ? { ...DEFAULT_CONFIG, ...saved } : { ...DEFAULT_CONFIG }
  return cachedConfig
}

export async function saveConfig(config: LlmConfig): Promise<void> {
  const store = await loadStickyStore()
  const snapshot = { ...config }
  await store.set('llmConfig', snapshot)
  cachedConfig = snapshot
}

export const PRESETS: Record<string, string> = {
  polish: '请润色以下文字，保持原意但让表达更流畅自然。直接输出润色后的文字，不要加额外解释：',
  translate: '请将以下文字翻译为英文。直接输出翻译结果：',
  summarize: '请用简洁的语言总结以下内容的要点：',
  organize: '请将以下内容整理成清晰的待办清单，每项一行，用"- "开头：',
}

export function isTauriRuntime(): boolean {
  return isDesktopRuntime
}

/**
 * Keep recent context within a predictable request budget. Consecutive messages
 * from the same role are folded together because the Anthropic API expects
 * alternating turns.
 */
export function boundChatHistory(
  messages: ChatMessage[],
  maxMessages = MAX_CONTEXT_MESSAGES,
  maxChars = MAX_CONTEXT_CHARS,
): ChatMessage[] {
  const recent: ChatMessage[] = []
  let chars = 0

  for (let index = messages.length - 1; index >= 0 && recent.length < maxMessages; index -= 1) {
    const message = messages[index]
    const remaining = maxChars - chars
    if (remaining <= 0) break

    if (message.content.length > remaining) {
      // Always retain at least the newest turn, but do not send an unbounded prompt.
      if (recent.length === 0) {
        recent.push({ ...message, content: `${message.content.slice(0, Math.max(0, remaining - 12))}\n[内容已截断]` })
      }
      break
    }

    recent.push({ ...message })
    chars += message.content.length
  }

  const chronological = recent.reverse()
  while (chronological[0]?.role === 'assistant') chronological.shift()

  return chronological.reduce<ChatMessage[]>((result, message) => {
    const previous = result[result.length - 1]
    if (previous?.role === message.role) {
      previous.content += `\n\n${message.content}`
    } else {
      result.push({ ...message })
    }
    return result
  }, [])
}

function validateConfig(config: LlmConfig): string | null {
  if (!config.baseUrl.trim()) return '请先在设置中填写 Base URL'
  if (!config.apiKey.trim()) return '请先在设置中填写 API Key'
  if (!config.model.trim()) return '请先在设置中填写 Model'
  return null
}

function requestFetch(input: string, init: RequestInit): Promise<Response> {
  return platformFetch(input, init)
}

export function formatRequestError(
  error: unknown,
  desktop = isTauriRuntime(),
  online = typeof navigator === 'undefined' || navigator.onLine !== false,
): string {
  const detail = error instanceof Error ? error.message : String(error)
  if (!desktop && !online) {
    return '当前离线，连接网络后再试。'
  }
  if (!desktop) {
    return `浏览器无法访问该接口（可能被 CORS 拦截）。请确认服务允许当前 localhost 来源，或改用桌面端。${detail ? `\n${detail}` : ''}`
  }
  return `请求失败: ${detail}`
}

export async function testConnection(config: LlmConfig, signal?: AbortSignal): Promise<string> {
  const configError = validateConfig(config)
  if (configError) throw new Error(configError)

  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '')
  try {
    const response = await requestFetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model.trim(),
        max_tokens: 1,
        stream: false,
        messages: [{ role: 'user', content: 'Reply OK.' }],
      }),
      signal,
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800)
      throw new Error(`API 错误 ${response.status}: ${detail}`)
    }
    return `连接成功 · ${config.model.trim()}`
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof Error && error.message.startsWith('API 错误')) throw error
    throw new Error(formatRequestError(error))
  }
}

export async function streamChat(
  messages: ChatMessage[],
  systemPrompt: string | null,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const config = await loadConfig()
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '')
  const model = config.model.trim()
  const apiKey = config.apiKey.trim()

  const configError = validateConfig(config)
  if (configError) {
    callbacks.onError(configError)
    return
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    stream: true,
    messages: boundChatHistory(messages).map(m => ({ role: m.role, content: m.content })),
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

  try {
    const response = await requestFetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      callbacks.onError(`API 错误 ${response.status}: ${errText.slice(0, 800)}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError('无法读取响应流')
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
            callbacks.onChunk(event.delta.text)
          } else if (event.type === 'error') {
            callbacks.onError(event.error?.message || '流式响应错误')
            return
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    callbacks.onDone()
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onAbort?.()
      return
    }
    callbacks.onError(formatRequestError(err))
  }
}
