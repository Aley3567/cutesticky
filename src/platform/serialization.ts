/**
 * Platform stores persist JSON data. Taking the JSON snapshot here also unwraps
 * Vue reactive proxies, which IndexedDB cannot structured-clone directly.
 */
export function snapshotStorageValue<T>(value: T): T {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch (error) {
    throw new TypeError(`数据无法序列化保存：${error instanceof Error ? error.message : String(error)}`)
  }

  if (serialized === undefined) throw new TypeError('数据无法序列化保存：不支持 undefined、函数或 symbol')
  return JSON.parse(serialized) as T
}
