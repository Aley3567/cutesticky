export interface CurrentWeather {
  temperature: number
  weatherCode: number
  humidity: number
  windSpeed: number
}

export interface HourlyWeather {
  time: string
  hour: string
  temperature: number
  weatherCode: number
}

export interface DailyWeather {
  date: string
  weekday: string
  tempMax: number
  tempMin: number
  weatherCode: number
}

export interface WeatherCache {
  city: string
  lat: number
  lon: number
  fetchedAt: number
  current: CurrentWeather
  hourly: HourlyWeather[]
  daily: DailyWeather[]
}

export const WEATHER_CACHE_TTL = 30 * 60 * 1000

export function sameWeatherLocation(cache: WeatherCache, lat: number, lon: number): boolean {
  return Math.abs(cache.lat - lat) < 0.001 && Math.abs(cache.lon - lon) < 0.001
}

export function isWeatherCacheFresh(cache: WeatherCache, lat: number, lon: number, now = Date.now()): boolean {
  return sameWeatherLocation(cache, lat, lon)
    && now >= cache.fetchedAt
    && now - cache.fetchedAt < WEATHER_CACHE_TTL
}

export function formatWeatherUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)
}
