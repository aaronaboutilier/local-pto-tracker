<script setup>
import { computed } from 'vue'
import { startOfDay } from '../../utils'
import { DEFAULT_EVENT_COLOR, PTO_COLORS } from '../../constants/pto'

const props = defineProps({
  currentDate: {
    type: Date,
    required: true,
  },
  events: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['select-date'])

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const indicatorColorByType = PTO_COLORS

function parseEventDate(value, isAllDay = false) {
  if (!value) {
    return null
  }

  if (typeof value === 'string' && isAllDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const eventMetaByDate = computed(() => {
  const meta = new Map()

  props.events.forEach((eventItem) => {
    if (!eventItem.start) {
      return
    }

    const eventType = eventItem.extendedProps?.type || 'vacation'
    const eventColor =
      indicatorColorByType[eventType] || eventItem.color || eventItem.backgroundColor || DEFAULT_EVENT_COLOR
    const eventTitle = eventItem.title || 'Untitled event'

    const parsedStart = parseEventDate(eventItem.start, eventItem.allDay)
    if (!parsedStart || Number.isNaN(parsedStart.getTime())) {
      return
    }

    const parsedEnd = eventItem.end
      ? parseEventDate(eventItem.end, eventItem.allDay)
      : parseEventDate(eventItem.start, eventItem.allDay)
    if (!parsedEnd || Number.isNaN(parsedEnd.getTime())) {
      return
    }

    const startDate = startOfDay(parsedStart)
    const rawEnd = parsedEnd
    const endDate = startOfDay(rawEnd)
    const lastDate = eventItem.allDay && eventItem.end
      ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1)
      : endDate

    for (let day = new Date(startDate); day <= lastDate; day.setDate(day.getDate() + 1)) {
      const key = toDateKey(day)
      const existing = meta.get(key)

      if (existing) {
        const hasType = existing.types.some((typeEntry) => typeEntry.type === eventType)
        const nextTypes = hasType
          ? existing.types
          : [
              ...existing.types,
              {
                type: eventType,
                color: eventColor,
              },
            ]

        meta.set(key, {
          count: existing.count + 1,
          color: existing.color,
          titles: [...existing.titles, eventTitle],
          types: nextTypes,
        })
      } else {
        meta.set(key, {
          count: 1,
          color: eventColor,
          titles: [eventTitle],
          types: [
            {
              type: eventType,
              color: eventColor,
            },
          ],
        })
      }
    }
  })

  return meta
})

function buildMonth(monthIndex) {
  const year = props.currentDate.getFullYear()
  const firstOfMonth = new Date(year, monthIndex, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells = []

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({
      key: `blank-${monthIndex}-${i}`,
      isBlank: true,
    })
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, monthIndex, dayNumber)
    const key = toDateKey(date)

    cells.push({
      key,
      isBlank: false,
      label: dayNumber,
      date,
      eventCount: eventMetaByDate.value.get(key)?.count || 0,
      eventColor: eventMetaByDate.value.get(key)?.color || DEFAULT_EVENT_COLOR,
      eventTitles: eventMetaByDate.value.get(key)?.titles || [],
      indicatorColors: (eventMetaByDate.value.get(key)?.types || []).map((entry) => entry.color),
    })
  }

  return {
    key: `month-${monthIndex}`,
    name: firstOfMonth.toLocaleDateString(undefined, { month: 'short' }),
    cells,
  }
}

const months = computed(() => {
  return Array.from({ length: 12 }, (_, index) => buildMonth(index))
})

function isToday(date) {
  const now = new Date()
  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  )
}

function onDateClick(date) {
  emit('select-date', date)
}

function eventTooltip(cell) {
  if (!cell.eventTitles?.length) {
    return ''
  }

  return `${cell.eventCount} events\n${cell.eventTitles.join('\n')}`
}
</script>

<template>
  <section class="year-grid">
    <article v-for="month in months" :key="month.key" class="year-month-card">
      <h2 class="year-month-title">{{ month.name }}</h2>

      <div class="year-weekdays">
        <span v-for="weekday in weekdayLabels" :key="`${month.key}-${weekday}`">{{ weekday }}</span>
      </div>

      <div class="year-month-cells">
        <button
          v-for="cell in month.cells"
          :key="cell.key"
          class="year-day-cell"
          :class="{
            'is-blank': cell.isBlank,
            'is-today': !cell.isBlank && isToday(cell.date),
            'has-events': !cell.isBlank && cell.eventCount > 0,
          }"
          :title="!cell.isBlank && cell.eventCount > 0 ? eventTooltip(cell) : ''"
          :disabled="cell.isBlank"
          @click="!cell.isBlank && onDateClick(cell.date)"
        >
          <span v-if="!cell.isBlank">{{ cell.label }}</span>
          <span v-if="!cell.isBlank && cell.eventCount > 0" class="event-dots">
            <span
              v-for="(indicatorColor, index) in cell.indicatorColors"
              :key="`${cell.key}-dot-${index}`"
              class="event-dot"
              :style="{ backgroundColor: indicatorColor }"
            ></span>
          </span>
        </button>
      </div>
    </article>
  </section>
</template>
