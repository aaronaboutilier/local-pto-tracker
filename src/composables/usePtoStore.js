import { computed, reactive, watch } from 'vue'
import { mockEvents } from '../mockEvents'

const STORAGE_KEY = 'local_pto_tracker_v1'
const THEME_MODES = ['system', 'light', 'dark']

const DEFAULT_BALANCES = {
  vacation: 112.5,
  vpp: 37.5,
  sick: 75,
  personal: 15,
}
const BUCKET_KEYS = ['vpp', 'vacation', 'sick', 'personal']
const EVENT_TYPES = ['vpp', 'vacation', 'sick', 'personal', 'holiday']

const PTO_COLORS = {
  vacation: '#2980B9',
  vpp: '#8E44AD',
  sick: '#C0392B',
  personal: '#27AE60',
  holiday: '#F9AB00',
}

function toLocalDateTimeString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function normalizeEvent(eventItem, index) {
  const eventType = eventItem.extendedProps?.type || 'vacation'
  const eventHours =
    typeof eventItem.extendedProps?.hours === 'number'
      ? eventItem.extendedProps.hours
      : eventItem.allDay
        ? 7.5
        : 1
  const isAllDayEvent = Boolean(eventItem.allDay)

  let normalizedEnd = eventItem.end

  if (!isAllDayEvent && eventItem.start) {
    const startDate = new Date(eventItem.start)
    if (!Number.isNaN(startDate.getTime())) {
      const computedEnd = new Date(startDate)
      computedEnd.setMinutes(computedEnd.getMinutes() + Math.round(eventHours * 60))
      normalizedEnd = toLocalDateTimeString(computedEnd)
    }
  }

  return {
    ...eventItem,
    id: eventItem.id || String(index + 1),
    end: normalizedEnd,
    color: eventItem.color || PTO_COLORS[eventType] || '#1a73e8',
    extendedProps: {
      ...eventItem.extendedProps,
      type: eventType,
      hours: eventHours,
    },
  }
}

const state = reactive({
  settings: {
    hoursPerDay: 7.5,
    fiscalYearStartMonth: 3,
    showHolidayInTracker: true,
    themeMode: 'system',
    bucketSizes: { ...DEFAULT_BALANCES },
  },
  yearlyBalances: {},
  events: mockEvents.map(normalizeEvent),
})

let hasInitialized = false
let hasStartedAutoSave = false

function cloneDefaultBalances() {
  return { ...state.settings.bucketSizes }
}

function getFiscalYear(date = new Date()) {
  const dateValue = new Date(date)
  return dateValue.getMonth() < state.settings.fiscalYearStartMonth
    ? dateValue.getFullYear() - 1
    : dateValue.getFullYear()
}

function ensureBalanceForYear(fiscalYear) {
  const key = String(fiscalYear)
  if (!state.yearlyBalances[key]) {
    state.yearlyBalances[key] = cloneDefaultBalances()
  }

  BUCKET_KEYS.forEach((bucketKey) => {
    if (typeof state.yearlyBalances[key][bucketKey] !== 'number') {
      state.yearlyBalances[key][bucketKey] = Number(state.settings.bucketSizes[bucketKey] || 0)
    }
  })

  return state.yearlyBalances[key]
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function load() {
  if (hasInitialized) {
    return
  }

  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored)

      if (parsed.settings) {
        state.settings = {
          ...state.settings,
          ...parsed.settings,
          bucketSizes: {
            ...state.settings.bucketSizes,
            ...(parsed.settings.bucketSizes || {}),
          },
        }
      }

      if (parsed.yearlyBalances && typeof parsed.yearlyBalances === 'object') {
        state.yearlyBalances = parsed.yearlyBalances
      }

      if (Array.isArray(parsed.events)) {
        state.events = parsed.events.map(normalizeEvent)
      }
    } catch {
      state.events = mockEvents.map(normalizeEvent)
    }
  }

  ensureBalanceForYear(getFiscalYear())
  hasInitialized = true
}

function startAutoSave() {
  if (hasStartedAutoSave) {
    return
  }

  watch(state, save, { deep: true })
  hasStartedAutoSave = true
}

const currentFy = computed(() => String(getFiscalYear()))

const activeBalance = computed(() => {
  return ensureBalanceForYear(currentFy.value)
})

const usageStats = computed(() => {
  const fiscalYear = currentFy.value
  const totals = EVENT_TYPES.reduce((accumulator, eventType) => {
    accumulator[eventType] = 0
    return accumulator
  }, {})

  state.events.forEach((eventItem) => {
    if (!eventItem.start) {
      return
    }

    if (String(getFiscalYear(eventItem.start)) !== fiscalYear) {
      return
    }

    const eventType = eventItem.extendedProps?.type
    const eventHours = Number(eventItem.extendedProps?.hours || 0)

    if (eventType && totals[eventType] !== undefined) {
      totals[eventType] += eventHours
    }
  })

  return totals
})

function setEvents(events) {
  state.events = events.map(normalizeEvent)
}

function addEvent(eventItem) {
  state.events.push(normalizeEvent(eventItem, state.events.length))
}

function upsertEvent(eventItem) {
  const normalized = normalizeEvent(eventItem, state.events.length)
  const existingIndex = state.events.findIndex((entry) => entry.id === normalized.id)

  if (existingIndex >= 0) {
    state.events.splice(existingIndex, 1, normalized)
    return
  }

  state.events.push(normalized)
}

function deleteEvent(eventId) {
  state.events = state.events.filter((entry) => entry.id !== eventId)
}

function clearEvents() {
  state.events = []
}

function updateSettings(nextSettings) {
  state.settings = {
    ...state.settings,
    ...nextSettings,
    bucketSizes: {
      ...state.settings.bucketSizes,
      ...(nextSettings.bucketSizes || {}),
    },
  }
}

function updateFiscalYearStartMonth(month) {
  const parsedMonth = Number(month)
  const normalizedMonth = Number.isFinite(parsedMonth)
    ? Math.min(Math.max(parsedMonth, 0), 11)
    : 0

  state.settings.fiscalYearStartMonth = normalizedMonth
  ensureBalanceForYear(getFiscalYear())
}

function updateBucketSize(bucket, hours) {
  if (!BUCKET_KEYS.includes(bucket)) {
    return
  }

  const parsedHours = Number(hours)
  const normalizedHours = Number.isFinite(parsedHours) ? Math.max(parsedHours, 0) : 0

  state.settings.bucketSizes = {
    ...state.settings.bucketSizes,
    [bucket]: normalizedHours,
  }

  const balance = ensureBalanceForYear(getFiscalYear())
  balance[bucket] = normalizedHours
}

function updateHoursPerDay(hours) {
  const parsedHours = Number(hours)
  const normalizedHours = Number.isFinite(parsedHours) ? Math.max(parsedHours, 0.25) : 7.5
  state.settings.hoursPerDay = normalizedHours
}

function updateShowHolidayInTracker(value) {
  state.settings.showHolidayInTracker = Boolean(value)
}

function updateThemeMode(mode) {
  const normalizedMode = THEME_MODES.includes(mode) ? mode : 'system'
  state.settings.themeMode = normalizedMode
}

export function usePtoStore() {
  load()
  startAutoSave()

  return {
    state,
    currentFy,
    activeBalance,
    usageStats,
    getFiscalYear,
    setEvents,
    addEvent,
    upsertEvent,
    deleteEvent,
    clearEvents,
    updateSettings,
    updateFiscalYearStartMonth,
    updateBucketSize,
    updateHoursPerDay,
    updateShowHolidayInTracker,
    updateThemeMode,
    save,
    load,
    defaultBalances: DEFAULT_BALANCES,
    ptoColors: PTO_COLORS,
  }
}
