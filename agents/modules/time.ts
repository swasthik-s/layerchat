import axios from 'axios'
import { Agent, AgentResponse } from '@/types'

export class TimeAgent implements Agent {
  name = 'World Time'
  description = 'Get current time, date, and timezone information for any location using WorldTimeAPI'
  trigger = /what time|current time|time in|what\'s the time|what time is it|clock|timezone|date today|today\'s date|current date/i

  async run(input: string): Promise<AgentResponse> {
    try {
      // Extract location from input if mentioned
      const locationMatch = input.match(/time in ([^?]+)|time for ([^?]+)|in ([^?]+)/i)
      let location = locationMatch ? (locationMatch[1] || locationMatch[2] || locationMatch[3]).trim() : null
      
      // Map common location names to timezone identifiers
      const timezoneMap: { [key: string]: string } = {
        'india': 'Asia/Kolkata',
        'usa': 'America/New_York',
        'uk': 'Europe/London',
        'japan': 'Asia/Tokyo',
        'australia': 'Australia/Sydney',
        'germany': 'Europe/Berlin',
        'france': 'Europe/Paris',
        'china': 'Asia/Shanghai',
        'brazil': 'America/Sao_Paulo',
        'russia': 'Europe/Moscow',
        'new york': 'America/New_York',
        'los angeles': 'America/Los_Angeles',
        'london': 'Europe/London',
        'tokyo': 'Asia/Tokyo',
        'sydney': 'Australia/Sydney',
        'paris': 'Europe/Paris',
        'berlin': 'Europe/Berlin',
        'moscow': 'Europe/Moscow',
        'dubai': 'Asia/Dubai',
        'singapore': 'Asia/Singapore'
      }

      let timezone = 'UTC'
      if (location) {
        const normalizedLocation = location.toLowerCase()
        timezone = timezoneMap[normalizedLocation] || `America/New_York` // fallback
      }

      // Use WorldTimeAPI - free and reliable
      const timeUrl = location 
        ? `http://worldtimeapi.org/api/timezone/${timezone}`
        : `http://worldtimeapi.org/api/ip` // Get time based on IP location

      const response = await axios.get(timeUrl, { timeout: 8000 })
      const timeData = response.data

      const datetime = new Date(timeData.datetime)
      const formattedTime = datetime.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      const formattedDate = datetime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      return {
        id: `time-${Date.now()}`,
        data: {
          location: location || timeData.timezone || 'Current location',
          timezone: timeData.timezone,
          currentTime: formattedTime,
          currentDate: formattedDate,
          datetime: timeData.datetime,
          utcTime: timeData.utc_datetime,
          utcOffset: timeData.utc_offset,
          isDST: timeData.dst,
          abbreviation: timeData.abbreviation,
          weekNumber: timeData.week_number,
          dayOfYear: timeData.day_of_year,
          unixTime: timeData.unixtime,
          message: `Current time in ${location || timeData.timezone}`
        },
        type: 'json',
        metadata: {
          source: 'worldtimeapi',
          timestamp: Date.now(),
          location: location,
          api: 'WorldTimeAPI (Free)'
        }
      }
    } catch (error) {
      console.error('Time agent error:', error)
      
      // Fallback to system time with location estimation
      const now = new Date()
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      return {
        id: `time-${Date.now()}`,
        data: {
          location: input.match(/time in ([^?]+)/i)?.[1]?.trim() || 'System location',
          timezone: systemTimezone,
          currentTime: now.toLocaleTimeString('en-US', { hour12: true }),
          currentDate: now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          datetime: now.toISOString(),
          message: 'Using system time (WorldTimeAPI unavailable)',
          error: 'WorldTimeAPI service temporarily unavailable'
        },
        type: 'json',
        metadata: {
          source: 'system_time_fallback',
          timestamp: Date.now(),
          error: true,
          api: 'System Fallback'
        }
      }
    }
  }
}
