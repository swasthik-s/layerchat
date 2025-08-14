import axios from 'axios'
import { Agent, AgentResponse } from '@/types'

export class WeatherAgent implements Agent {
  name = 'Weather'
  description = 'Get current weather and forecasts for any location using real weather APIs'
  trigger = /@weather|weather in|temperature|forecast|climate|how\'s the weather/i

  async run(input: string): Promise<AgentResponse> {
    try {
      // Extract location from input
      const locationMatch = input.match(/(?:weather in|weather for|temperature in)\s*([^,.\n?]+)/i) ||
                           input.match(/weather\s+(.+?)(?:\?|$)/i)
      
      const location = locationMatch?.[1]?.trim() || 'London' // Default location

      // Use wttr.in - a free, no-API-key weather service
      const weatherUrl = `https://wttr.in/${encodeURIComponent(location)}?format=j1`
      
      const response = await axios.get(weatherUrl, { 
        timeout: 8000,
        headers: {
          'User-Agent': 'LayerChat/1.0'
        }
      })
      
      const weatherData = response.data
      const current = weatherData.current_condition[0]
      const today = weatherData.weather[0]
      
      // Parse and format the weather data
      const formattedData = {
        location: weatherData.nearest_area[0]?.areaName[0]?.value || location,
        country: weatherData.nearest_area[0]?.country[0]?.value || '',
        region: weatherData.nearest_area[0]?.region[0]?.value || '',
        currentWeather: {
          temperature: `${current.temp_C}°C (${current.temp_F}°F)`,
          feelsLike: `${current.FeelsLikeC}°C (${current.FeelsLikeF}°F)`,
          condition: current.weatherDesc[0]?.value || 'Unknown',
          humidity: `${current.humidity}%`,
          windSpeed: `${current.windspeedKmph} km/h`,
          windDirection: current.winddir16Point,
          pressure: `${current.pressure} mb`,
          visibility: `${current.visibility} km`,
          uvIndex: current.uvIndex
        },
        forecast: weatherData.weather.slice(0, 3).map((day: any) => ({
          date: day.date,
          maxTemp: `${day.maxtempC}°C (${day.maxtempF}°F)`,
          minTemp: `${day.mintempC}°C (${day.mintempF}°F)`,
          condition: day.hourly[0]?.weatherDesc[0]?.value || 'Unknown',
          chanceOfRain: `${day.hourly[0]?.chanceofrain || 0}%`,
          chanceOfSnow: `${day.hourly[0]?.chanceofsnow || 0}%`
        })),
        lastUpdated: new Date().toLocaleString(),
        source: 'wttr.in (World Weather Online)'
      }

      return {
        id: `weather-${Date.now()}`,
        data: formattedData,
        type: 'json',
        metadata: {
          source: 'wttr_weather_api',
          timestamp: Date.now(),
          location: location,
          api: 'wttr.in (Free)',
          coordinates: {
            lat: weatherData.nearest_area[0]?.latitude || '',
            lon: weatherData.nearest_area[0]?.longitude || ''
          }
        }
      }
    } catch (error) {
      console.error('Weather agent error:', error)
      
      // Enhanced fallback with more realistic mock data
      const mockData = {
        location: input.match(/(?:weather in|weather for|temperature in)\s*([^,.\n?]+)/i)?.[1]?.trim() || 'Unknown Location',
        error: 'Weather service temporarily unavailable',
        currentWeather: {
          temperature: 'N/A',
          condition: 'Unable to fetch current conditions',
          message: 'Weather data unavailable - please try again later'
        },
        suggestion: 'You can check weather by searching "weather in [location]" in your web browser',
        fallbackInfo: 'Weather services may be temporarily down'
      }
      
      return {
        id: `weather-${Date.now()}`,
        data: mockData,
        type: 'json',
        metadata: {
          source: 'weather_fallback',
          timestamp: Date.now(),
          error: true,
          api: 'Fallback'
        }
      }
    }
  }
}
