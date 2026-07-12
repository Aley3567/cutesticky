import { describe, expect, it } from 'vitest'
import { WEATHER_CACHE_TTL, isWeatherCacheFresh, sameWeatherLocation, type WeatherCache } from '../weatherLogic'

const cache: WeatherCache = {
  city: '重庆',
  lat: 29.57,
  lon: 106.45,
  fetchedAt: 1_000_000,
  current: { temperature: 30, weatherCode: 1, humidity: 60, windSpeed: 8 },
  hourly: [],
  daily: [],
}

describe('weather cache logic', () => {
  it('accepts the current location within coordinate precision', () => {
    expect(sameWeatherLocation(cache, 29.5704, 106.4504)).toBe(true)
    expect(sameWeatherLocation(cache, 30, 106.45)).toBe(false)
  })

  it('keeps cached weather fresh for less than thirty minutes', () => {
    expect(isWeatherCacheFresh(cache, cache.lat, cache.lon, cache.fetchedAt + WEATHER_CACHE_TTL - 1)).toBe(true)
    expect(isWeatherCacheFresh(cache, cache.lat, cache.lon, cache.fetchedAt + WEATHER_CACHE_TTL)).toBe(false)
  })

  it('rejects cache timestamps from the future', () => {
    expect(isWeatherCacheFresh(cache, cache.lat, cache.lon, cache.fetchedAt - 1)).toBe(false)
  })
})
