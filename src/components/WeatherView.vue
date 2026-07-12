<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { platformFetch } from '../platform'
import { loadStickyStore, type StickyStore } from '../services/stickyStore'
import {
  WEATHER_CACHE_TTL,
  formatWeatherUpdatedAt,
  isWeatherCacheFresh,
  sameWeatherLocation,
  type CurrentWeather,
  type DailyWeather,
  type HourlyWeather,
  type WeatherCache,
} from '../services/weatherLogic'

interface CityCandidate {
  id: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

interface ForecastResponse {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
  }
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] }
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] }
}

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const WMO_DESC: Record<number, string> = {
  0: '晴', 1: '大部晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '中阵雨', 82: '大阵雨',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷阵雨',
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const city = ref('重庆沙坪坝')
const cityInput = ref('')
const editingCity = ref(false)
const candidates = ref<CityCandidate[]>([])
const searchingCity = ref(false)
const loading = ref(false)
const error = ref('')
const current = ref<CurrentWeather | null>(null)
const hourly = ref<HourlyWeather[]>([])
const daily = ref<DailyWeather[]>([])
const lat = ref(29.57)
const lon = ref(106.45)
const lastUpdated = ref<number | null>(null)
const showingCachedData = ref(false)

let refreshTimer: ReturnType<typeof setInterval> | null = null
let store: StickyStore | null = null
let cachedSnapshot: WeatherCache | null = null
let weatherController: AbortController | null = null
let cityController: AbortController | null = null
let initialized = false
let active = false
let weatherRequestId = 0
let cityRequestId = 0

const currentIcon = computed(() => current.value ? getIcon(current.value.weatherCode) : '')
const currentDesc = computed(() => current.value ? getDescription(current.value.weatherCode) : '')
const updatedLabel = computed(() => lastUpdated.value ? formatWeatherUpdatedAt(lastUpdated.value) : '')
const temperatureRange = computed(() => {
  const values = daily.value.flatMap(item => [item.tempMin, item.tempMax])
  return { min: Math.min(...values), max: Math.max(...values) }
})

function getIcon(code: number) { return WMO_ICONS[code] ?? '☁️' }
function getDescription(code: number) { return WMO_DESC[code] ?? '未知' }

function isForecastResponse(value: unknown): value is ForecastResponse {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ForecastResponse>
  return Boolean(
    data.current
    && typeof data.current.temperature_2m === 'number'
    && data.hourly
    && Array.isArray(data.hourly.time)
    && Array.isArray(data.hourly.temperature_2m)
    && Array.isArray(data.hourly.weather_code)
    && data.daily
    && Array.isArray(data.daily.time)
    && Array.isArray(data.daily.temperature_2m_max)
    && Array.isArray(data.daily.temperature_2m_min)
    && Array.isArray(data.daily.weather_code),
  )
}

function isWeatherCache(value: unknown): value is WeatherCache {
  if (!value || typeof value !== 'object') return false
  const cache = value as Partial<WeatherCache>
  return typeof cache.city === 'string'
    && typeof cache.lat === 'number'
    && typeof cache.lon === 'number'
    && typeof cache.fetchedAt === 'number'
    && Boolean(cache.current)
    && Array.isArray(cache.hourly)
    && Array.isArray(cache.daily)
}

async function requestJson(url: string, controller: AbortController, timeoutMs = 10_000): Promise<unknown> {
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await platformFetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof Error && reason.name === 'AbortError'
}

function applyCache(cache: WeatherCache, cached: boolean) {
  current.value = cache.current
  hourly.value = cache.hourly
  daily.value = cache.daily
  lastUpdated.value = cache.fetchedAt
  showingCachedData.value = cached
}

function parseForecast(data: ForecastResponse, fetchedAt: number): WeatherCache {
  const now = new Date(fetchedAt)
  const currentHour = now.getHours()
  const currentDate = now.getDate()
  const foundIndex = data.hourly.time.findIndex(time => {
    const date = new Date(time)
    return date.getDate() !== currentDate || date.getHours() >= currentHour
  })
  const startIndex = Math.max(0, foundIndex)

  const nextHours = data.hourly.time.slice(startIndex, startIndex + 24).map((time, index) => ({
    time,
    hour: index === 0 ? '现在' : `${String(new Date(time).getHours()).padStart(2, '0')}:00`,
    temperature: Math.round(data.hourly.temperature_2m[startIndex + index] ?? 0),
    weatherCode: data.hourly.weather_code[startIndex + index] ?? 3,
  }))

  const nextDays = data.daily.time.map((dateString, index) => {
    const date = new Date(`${dateString}T12:00:00`)
    return {
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      weekday: index === 0 ? '今天' : index === 1 ? '明天' : WEEKDAYS[date.getDay()],
      tempMax: Math.round(data.daily.temperature_2m_max[index] ?? 0),
      tempMin: Math.round(data.daily.temperature_2m_min[index] ?? 0),
      weatherCode: data.daily.weather_code[index] ?? 3,
    }
  })

  return {
    city: city.value,
    lat: lat.value,
    lon: lon.value,
    fetchedAt,
    current: {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m),
    },
    hourly: nextHours,
    daily: nextDays,
  }
}

async function fetchWeather(force = false) {
  if (!force && cachedSnapshot && isWeatherCacheFresh(cachedSnapshot, lat.value, lon.value)) {
    applyCache(cachedSnapshot, false)
    return
  }

  const requestId = ++weatherRequestId
  weatherController?.abort()
  const controller = new AbortController()
  weatherController = controller
  loading.value = true
  error.value = ''

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.value}&longitude=${lon.value}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Shanghai&forecast_days=7`
    const data = await requestJson(url, controller)
    if (requestId !== weatherRequestId) return
    if (!isForecastResponse(data)) throw new Error('Invalid weather response')

    cachedSnapshot = parseForecast(data, Date.now())
    error.value = ''
    applyCache(cachedSnapshot, false)
    await store?.set('weatherCache:v1', cachedSnapshot)
    await store?.save()
  } catch (reason) {
    if (requestId !== weatherRequestId) return
    if (isAbortError(reason) && !active) return
    const timedOut = isAbortError(reason)
    if (cachedSnapshot && sameWeatherLocation(cachedSnapshot, lat.value, lon.value)) {
      applyCache(cachedSnapshot, true)
      error.value = timedOut ? '更新超时，正在显示上次数据' : '暂时无法更新，正在显示上次数据'
    } else {
      error.value = timedOut ? '天气请求超时，请重试' : '天气暂时无法获取，请重试'
    }
  } finally {
    if (requestId === weatherRequestId) loading.value = false
  }
}

async function searchCities() {
  const query = cityInput.value.trim()
  if (!query) return

  const requestId = ++cityRequestId
  cityController?.abort()
  const controller = new AbortController()
  cityController = controller
  searchingCity.value = true
  candidates.value = []
  error.value = ''

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=zh&format=json`
    const data = await requestJson(url, controller, 8000) as { results?: CityCandidate[] }
    if (requestId !== cityRequestId) return
    candidates.value = Array.isArray(data.results) ? data.results : []
    error.value = ''
    if (!candidates.value.length) error.value = '没有找到匹配的城市'
  } catch (reason) {
    if (requestId !== cityRequestId) return
    if (isAbortError(reason) && (!editingCity.value || !active)) return
    const timedOut = isAbortError(reason)
    error.value = timedOut ? '城市搜索超时，请重试' : '城市搜索失败，请重试'
  } finally {
    if (requestId === cityRequestId) searchingCity.value = false
  }
}

function cityCandidateLabel(candidate: CityCandidate): string {
  return [candidate.name, candidate.admin1, candidate.country].filter(Boolean).join(' · ')
}

async function selectCity(candidate: CityCandidate) {
  city.value = candidate.name
  lat.value = candidate.latitude
  lon.value = candidate.longitude
  editingCity.value = false
  candidates.value = []
  current.value = null
  hourly.value = []
  daily.value = []
  lastUpdated.value = null
  showingCachedData.value = false

  await store?.set('weatherCity', { name: city.value, lat: lat.value, lon: lon.value })
  await store?.save()
  await fetchWeather(true)
}

function startEditCity() {
  cityInput.value = city.value
  candidates.value = []
  editingCity.value = true
}

function stopEditCity() {
  cityRequestId += 1
  cityController?.abort()
  candidates.value = []
  editingCity.value = false
  error.value = ''
}

function dailyBarStyle(item: DailyWeather) {
  const span = Math.max(1, temperatureRange.value.max - temperatureRange.value.min)
  const left = ((item.tempMin - temperatureRange.value.min) / span) * 100
  const width = Math.max(12, ((item.tempMax - item.tempMin) / span) * 100)
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }
}

function startRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => void fetchWeather(true), WEATHER_CACHE_TTL)
}

function stopBackgroundWork() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  weatherRequestId += 1
  cityRequestId += 1
  weatherController?.abort()
  cityController?.abort()
  loading.value = false
  searchingCity.value = false
}

onMounted(async () => {
  store = await loadStickyStore()
  const savedCity = await store.get<{ name: string; lat: number; lon: number }>('weatherCity')
  if (savedCity && typeof savedCity.name === 'string' && typeof savedCity.lat === 'number' && typeof savedCity.lon === 'number') {
    city.value = savedCity.name
    lat.value = savedCity.lat
    lon.value = savedCity.lon
  }

  const savedCache = await store.get<unknown>('weatherCache:v1')
  if (isWeatherCache(savedCache) && sameWeatherLocation(savedCache, lat.value, lon.value)) {
    cachedSnapshot = savedCache
    applyCache(savedCache, !isWeatherCacheFresh(savedCache, lat.value, lon.value))
  }

  await fetchWeather(false)
  initialized = true
  if (active) startRefreshTimer()
})

onActivated(() => {
  active = true
  if (!initialized) return
  startRefreshTimer()
  if (!cachedSnapshot || !isWeatherCacheFresh(cachedSnapshot, lat.value, lon.value)) {
    void fetchWeather(false)
  }
})

onDeactivated(() => {
  active = false
  stopBackgroundWork()
})

onUnmounted(() => {
  active = false
  stopBackgroundWork()
})
</script>

<template>
  <div class="weather">
    <div v-if="editingCity" class="city-editor">
      <form class="city-search" @submit.prevent="searchCities">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input v-model="cityInput" placeholder="输入城市名" aria-label="输入城市名" autofocus @keydown.escape="stopEditCity" />
        <button type="submit" :disabled="searchingCity">{{ searchingCity ? '搜索中' : '搜索' }}</button>
        <button type="button" class="cancel-search" @click="stopEditCity" aria-label="取消搜索">×</button>
      </form>
      <div v-if="candidates.length" class="candidate-list">
        <button v-for="candidate in candidates" :key="candidate.id" :title="cityCandidateLabel(candidate)" @click="selectCity(candidate)">
          <span>{{ candidate.name }}</span>
          <small>{{ [candidate.admin1, candidate.country].filter(Boolean).join(' · ') }}</small>
        </button>
      </div>
    </div>

    <div v-else class="city-row">
      <button class="city-name" @click="startEditCity" title="更换城市">
        <span>{{ city }}</span>
        <small v-if="updatedLabel">上次更新 {{ updatedLabel }}<b v-if="showingCachedData"> · 缓存</b></small>
      </button>
      <button class="refresh-btn" @click="() => fetchWeather(true)" :class="{ spinning: loading }" :disabled="loading" title="刷新天气" aria-label="刷新天气">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12a9 9 0 1 1 3 6.7"/><polyline points="3 7 3 13 9 13"/></svg>
      </button>
    </div>

    <div v-if="error" class="error-msg" role="status">
      <span>{{ error }}</span>
      <button v-if="!editingCity" @click="() => fetchWeather(true)">重试</button>
    </div>

    <template v-if="current">
      <div class="current-block">
        <span class="current-icon">{{ currentIcon }}</span>
        <div class="current-info">
          <span class="current-temp">{{ current.temperature }}°</span>
          <span class="current-desc">{{ currentDesc }}</span>
        </div>
        <div class="current-detail">
          <span>湿度 {{ current.humidity }}%</span>
          <span>风速 {{ current.windSpeed }} km/h</span>
        </div>
      </div>

      <div class="section-label">逐时预报</div>
      <div class="hourly-scroll">
        <div v-for="hourItem in hourly" :key="hourItem.time" class="hourly-item">
          <span class="h-time">{{ hourItem.hour }}</span>
          <span class="h-icon">{{ getIcon(hourItem.weatherCode) }}</span>
          <span class="h-temp">{{ hourItem.temperature }}°</span>
        </div>
      </div>

      <div class="section-label">未来 7 天</div>
      <div class="daily-card">
        <div v-for="day in daily" :key="day.date" class="daily-row">
          <span class="d-day">{{ day.weekday }}</span>
          <span class="d-icon">{{ getIcon(day.weatherCode) }}</span>
          <div class="d-bar-wrap"><div class="d-bar" :style="dailyBarStyle(day)" /></div>
          <span class="d-temp"><b>{{ day.tempMin }}°</b> {{ day.tempMax }}°</span>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="loading-state">
      <span class="loading-disc" />
      <span>正在获取天气…</span>
    </div>

    <div v-else class="empty-state">
      <span>暂无天气数据</span>
      <button @click="() => fetchWeather(true)">重新加载</button>
    </div>
  </div>
</template>

<style scoped>
.weather { display: flex; flex-direction: column; gap: var(--space-3); min-height: 100%; }
.city-row { min-height: 34px; display: flex; align-items: center; gap: var(--space-2); }
.city-name {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--ink-1);
  text-align: left;
}
.city-name > span { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 800; }
.city-name small { color: var(--ink-3); font-size: 9px; font-weight: 700; }
.city-name small b { color: var(--accent-color); }
.refresh-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 10px;
  background: var(--surface-color);
  color: var(--ink-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-raised);
  margin-left: auto;
  flex: none;
}
.refresh-btn:disabled { cursor: wait; }
.refresh-btn svg { width: 13px; height: 13px; }
.refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.city-editor { display: flex; flex-direction: column; gap: var(--space-2); }
.city-search {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 7px 0 10px;
  border-radius: var(--radius-sm);
  background: var(--tint-color);
  box-shadow: var(--shadow-pressed), 0 0 0 2px var(--accent-soft);
  color: var(--ink-3);
}
.city-search > svg { width: 13px; height: 13px; flex: none; }
.city-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink-1); font-size: 12px; }
.city-search button { border: 0; background: transparent; color: var(--accent-color); cursor: pointer; font-size: 10px; font-weight: 800; white-space: nowrap; }
.city-search button:disabled { color: var(--ink-3); cursor: wait; }
.city-search .cancel-search { width: 20px; color: var(--ink-3); font-size: 17px; font-weight: 500; }
.candidate-list { display: flex; flex-direction: column; overflow: hidden; border-radius: var(--radius-sm); background: var(--surface-color); box-shadow: var(--shadow-raised); }
.candidate-list button { min-height: 39px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; padding: 6px 11px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink-1); cursor: pointer; text-align: left; }
.candidate-list button:last-child { border-bottom: 0; }
.candidate-list button:hover { background: var(--tint-color); }
.candidate-list span { font-size: 12px; font-weight: 750; }
.candidate-list small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-3); font-size: 9px; font-weight: 650; }

.error-msg { display: flex; align-items: center; gap: var(--space-2); color: var(--ink-2); background: var(--accent-soft); padding: 7px 10px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; }
.error-msg span { flex: 1; }
.error-msg button { border: 0; background: transparent; color: var(--accent-color); cursor: pointer; font-size: 10px; font-weight: 800; }
.current-block { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-raised); }
.current-icon { font-size: 36px; line-height: 1; }
.current-info { display: flex; flex-direction: column; }
.current-temp { font-size: 34px; font-weight: 800; letter-spacing: -1px; line-height: 1; color: var(--ink-1); font-variant-numeric: tabular-nums; }
.current-desc { font-size: 12px; font-weight: 700; color: var(--ink-2); margin-top: 3px; }
.current-detail { display: flex; flex-direction: column; margin-left: auto; font-size: 10px; font-weight: 650; color: var(--ink-2); gap: 4px; text-align: right; white-space: nowrap; }
.section-label { font-size: 10px; font-weight: 800; color: var(--ink-3); letter-spacing: 0.5px; }
.hourly-scroll { display: flex; gap: var(--space-2); overflow-x: auto; padding: 1px 1px var(--space-1); scrollbar-width: none; }
.hourly-scroll::-webkit-scrollbar { display: none; }
.hourly-item { min-width: 46px; display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-2) var(--space-1); border-radius: var(--radius-sm); background: var(--surface-color); box-shadow: var(--shadow-raised); flex: none; }
.h-time { font-size: 9px; font-weight: 700; color: var(--ink-3); }
.h-icon { font-size: 16px; }
.h-temp { font-size: 12px; font-weight: 750; color: var(--ink-1); font-variant-numeric: tabular-nums; }
.daily-card { display: flex; flex-direction: column; gap: var(--space-2); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-raised); padding: var(--space-3) var(--space-4); }
.daily-row { display: flex; align-items: center; gap: var(--space-2); }
.d-day { width: 36px; flex: none; color: var(--ink-1); font-weight: 750; font-size: 11px; }
.d-icon { width: 18px; font-size: 14px; }
.d-bar-wrap { position: relative; flex: 1; height: 5px; border-radius: 3px; background: var(--tint-color); box-shadow: var(--shadow-pressed); overflow: hidden; }
.d-bar { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: var(--accent-color); opacity: 0.65; }
.d-temp { width: 61px; text-align: right; font-size: 11px; font-weight: 750; color: var(--ink-1); white-space: nowrap; font-variant-numeric: tabular-nums; }
.d-temp b { color: var(--ink-3); font-weight: 650; }
.loading-state, .empty-state { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); color: var(--ink-3); font-size: 12px; }
.loading-disc { width: 28px; height: 28px; border: 3px solid var(--tint-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; }
.empty-state button { border: 0; border-radius: 9px; background: var(--accent-soft); color: var(--accent-color); padding: 6px 10px; font-size: 10px; font-weight: 800; cursor: pointer; }
</style>
