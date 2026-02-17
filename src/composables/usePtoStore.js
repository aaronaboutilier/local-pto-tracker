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
const PTO_COLORS = {
  vacation: '#2980B9',
  vpp: '#8E44AD',
  sick: '#C0392B',
  personal: '#27AE60',
  holiday: '#F9AB00',
}
const DEFAULT_BUCKETS = [
  { key: 'vpp', label: 'VPP Vacation', color: PTO_COLORS.vpp },
  { key: 'vacation', label: 'Regular Vacation', color: PTO_COLORS.vacation },
  { key: 'sick', label: 'Sick Days', color: PTO_COLORS.sick },
  { key: 'personal', label: 'Personal', color: PTO_COLORS.personal },
]

function toLocalDateTimeString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function toDateOnlyString(value) {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const normalizedStart = isAllDayEvent
    ? toDateOnlyString(eventItem.start) || eventItem.start
    : eventItem.start

  let normalizedEnd = isAllDayEvent ? toDateOnlyString(eventItem.end) : eventItem.end

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
    start: normalizedStart,
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
    buckets: [...DEFAULT_BUCKETS],
  },
  yearlyBalances: {},
  events: mockEvents.map(normalizeEvent),
})

let hasInitialized = false
let hasStartedAutoSave = false

function normalizeBucketDefinitions(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return [...DEFAULT_BUCKETS]
  }

  const seen = new Set()

  return buckets.reduce((accumulator, bucket) => {
    const key = bucket?.key
    if (!key || seen.has(key)) {
      return accumulator
    }

    seen.add(key)
    accumulator.push({
      key,
      label: bucket.label || key,
      color: bucket.color || PTO_COLORS[key] || '#1a73e8',
    })

    return accumulator
  }, [])
}

function getBucketKeys() {
  return state.settings.buckets.map((bucket) => bucket.key)
}

function buildBucketSizesMap(bucketSizes = state.settings.bucketSizes) {
  const sizes = {}

  getBucketKeys().forEach((bucketKey) => {
    const value = bucketSizes?.[bucketKey]
    sizes[bucketKey] =
      typeof value === 'number' ? value : Number(DEFAULT_BALANCES[bucketKey] || 0)
  })

  return sizes
}

function cloneDefaultBalances() {
  return buildBucketSizesMap()
}

function resolveEventType(eventType) {
  if (eventType === 'holiday') {
    return 'holiday'
  }

  const bucketKeys = getBucketKeys()
  if (eventType && bucketKeys.includes(eventType)) {
    return eventType
  }

  return bucketKeys[0] || 'vacation'
}

function resolveEventColor(eventType) {
  if (eventType === 'holiday') {
    return PTO_COLORS.holiday
  }

  const bucket = state.settings.buckets.find((entry) => entry.key === eventType)
  return bucket?.color || PTO_COLORS[eventType] || '#1a73e8'
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
  } else {
    state.yearlyBalances[key] = buildBucketSizesMap(state.yearlyBalances[key])
  }

  return state.yearlyBalances[key]
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function applyPersistedState(parsed) {
  if (parsed.settings) {
    state.settings = {
      ...state.settings,
      ...parsed.settings,
      buckets: normalizeBucketDefinitions(parsed.settings.buckets || state.settings.buckets),
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

  state.settings.bucketSizes = buildBucketSizesMap(state.settings.bucketSizes)
  Object.keys(state.yearlyBalances).forEach((yearKey) => {
    state.yearlyBalances[yearKey] = buildBucketSizesMap(state.yearlyBalances[yearKey])
  })

  ensureBalanceForYear(getFiscalYear())
}

function getBackupPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(state)),
  }
}

function importBackupPayload(payload) {
  const candidate = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Backup payload is invalid.')
  }

  const hasValidEvents = candidate.events === undefined || Array.isArray(candidate.events)
  const hasValidSettings = candidate.settings === undefined || typeof candidate.settings === 'object'
  const hasValidBalances =
    candidate.yearlyBalances === undefined || typeof candidate.yearlyBalances === 'object'

  if (!hasValidEvents || !hasValidSettings || !hasValidBalances) {
    throw new Error('Backup payload does not match PTO tracker format.')
  }

  applyPersistedState(candidate)
}

function load() {
  if (hasInitialized) {
    return
  }

  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      applyPersistedState(parsed)
    } catch {
      state.events = mockEvents.map(normalizeEvent)
    }
  }

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
  const totals = getBucketKeys().reduce(
    (accumulator, bucketKey) => {
      accumulator[bucketKey] = 0
      return accumulator
    },
    { holiday: 0 },
  )

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
  state.events = events.map((eventItem, index) => {
    const normalizedType = resolveEventType(eventItem.extendedProps?.type)
    return normalizeEvent(
      {
        ...eventItem,
        color: eventItem.color || resolveEventColor(normalizedType),
        extendedProps: {
          ...eventItem.extendedProps,
          type: normalizedType,
        },
      },
      index,
    )
  })
}

function addEvent(eventItem) {
  const normalizedType = resolveEventType(eventItem.extendedProps?.type)
  state.events.push(
    normalizeEvent(
      {
        ...eventItem,
        color: eventItem.color || resolveEventColor(normalizedType),
        extendedProps: {
          ...eventItem.extendedProps,
          type: normalizedType,
        },
      },
      state.events.length,
    ),
  )
}

function upsertEvent(eventItem) {
  const normalizedType = resolveEventType(eventItem.extendedProps?.type)
  const normalized = normalizeEvent(
    {
      ...eventItem,
      color: eventItem.color || resolveEventColor(normalizedType),
      extendedProps: {
        ...eventItem.extendedProps,
        type: normalizedType,
      },
    },
    state.events.length,
  )
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
  const nextBuckets = nextSettings.buckets
    ? normalizeBucketDefinitions(nextSettings.buckets)
    : state.settings.buckets

  state.settings = {
    ...state.settings,
    ...nextSettings,
    buckets: nextBuckets,
    bucketSizes: {
      ...state.settings.bucketSizes,
      ...(nextSettings.bucketSizes || {}),
    },
  }

  state.settings.bucketSizes = buildBucketSizesMap(state.settings.bucketSizes)
  Object.keys(state.yearlyBalances).forEach((yearKey) => {
    state.yearlyBalances[yearKey] = buildBucketSizesMap(state.yearlyBalances[yearKey])
  })
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
  if (!getBucketKeys().includes(bucket)) {
    return
  }

  const parsedHours = Number(hours)
  const normalizedHours = Number.isFinite(parsedHours) ? Math.max(parsedHours, 0) : 0

  state.settings.bucketSizes = buildBucketSizesMap({
    ...state.settings.bucketSizes,
    [bucket]: normalizedHours,
  })

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

function addBucket(bucketDefinition) {
  if (!bucketDefinition?.key) {
    return
  }

  const updatedBuckets = normalizeBucketDefinitions([...state.settings.buckets, bucketDefinition])
  state.settings.buckets = updatedBuckets

  const defaultSize = Number.isFinite(bucketDefinition.hours) ? Math.max(bucketDefinition.hours, 0) : 0
  state.settings.bucketSizes = buildBucketSizesMap({
    ...state.settings.bucketSizes,
    [bucketDefinition.key]: defaultSize,
  })

  Object.keys(state.yearlyBalances).forEach((yearKey) => {
    state.yearlyBalances[yearKey] = buildBucketSizesMap(state.yearlyBalances[yearKey])
  })
}

function removeBucket(bucketKey) {
  if (!getBucketKeys().includes(bucketKey)) {
    return
  }

  state.settings.buckets = state.settings.buckets.filter((bucket) => bucket.key !== bucketKey)

  const { [bucketKey]: removedSize, ...restSizes } = state.settings.bucketSizes
  state.settings.bucketSizes = buildBucketSizesMap(restSizes)

  Object.keys(state.yearlyBalances).forEach((yearKey) => {
    const { [bucketKey]: removedBalance, ...restBalance } = state.yearlyBalances[yearKey] || {}
    state.yearlyBalances[yearKey] = buildBucketSizesMap(restBalance)
  })
}

const ptoColors = computed(() => {
  const colors = {}
  state.settings.buckets.forEach((bucket) => {
    colors[bucket.key] = bucket.color || PTO_COLORS[bucket.key] || '#1a73e8'
  })
  colors.holiday = PTO_COLORS.holiday
  return colors
})

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
    addBucket,
    removeBucket,
    getBackupPayload,
    importBackupPayload,
    save,
    load,
    defaultBalances: DEFAULT_BALANCES,
    ptoColors,
  }
}
