import { describe, expect, it } from 'vitest'
import { boundChatHistory, formatRequestError } from '../llm'

describe('boundChatHistory', () => {
  it('keeps only recent complete turns within the message limit', () => {
    const messages = [
      { role: 'user' as const, content: 'one' },
      { role: 'assistant' as const, content: 'two' },
      { role: 'user' as const, content: 'three' },
      { role: 'assistant' as const, content: 'four' },
      { role: 'user' as const, content: 'five' },
    ]

    expect(boundChatHistory(messages, 3, 100)).toEqual(messages.slice(2))
  })

  it('drops an orphan assistant and folds consecutive roles', () => {
    const result = boundChatHistory([
      { role: 'assistant', content: 'orphan' },
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'answer' },
    ])

    expect(result).toEqual([
      { role: 'user', content: 'first\n\nsecond' },
      { role: 'assistant', content: 'answer' },
    ])
  })

  it('truncates an oversized newest message', () => {
    const [result] = boundChatHistory([{ role: 'user', content: 'x'.repeat(100) }], 10, 40)

    expect(result.content).toContain('[内容已截断]')
    expect(result.content.length).toBeLessThanOrEqual(40)
  })
})

describe('formatRequestError', () => {
  it('distinguishes an offline browser from a CORS failure', () => {
    expect(formatRequestError(new TypeError('Failed to fetch'), false, false)).toBe('当前离线，连接网络后再试。')
    expect(formatRequestError(new TypeError('Failed to fetch'), false, true)).toContain('CORS')
  })

  it('keeps desktop request errors concise', () => {
    expect(formatRequestError(new Error('timeout'), true, true)).toBe('请求失败: timeout')
  })
})
