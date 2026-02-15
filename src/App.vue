<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import CalendarToolbar from './components/calendar/CalendarToolbar.vue'
import YearView from './components/calendar/YearView.vue'
import PtoTracker from './components/PtoTracker.vue'
import EventModal from './components/EventModal.vue'
import { usePtoStore } from './composables/usePtoStore'

const viewToFullCalendar = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
}

const activeView = ref('month')
const activeDate = ref(new Date())
const title = ref('')
const calendarRef = ref(null)
const calendarContentRef = ref(null)
const fullCalendarKey = ref(0)
const modalOpen = ref(false)
const modalMode = ref('create')
const modalInitialEvent = ref(null)
const {
  state,
  currentFy,
  activeBalance,
  usageStats,
  upsertEvent,
  deleteEvent,
  clearEvents,
  updateFiscalYearStartMonth,
  updateBucketSize,
  updateHoursPerDay,
  updateShowHolidayInTracker,
  updateThemeMode,
  addBucket,
  removeBucket,
  ptoColors,
} = usePtoStore()

let systemThemeMedia = null

const isYearView = computed(() => activeView.value === 'year')
const defaultBucketType = computed(() => state.settings.buckets[0]?.key || 'vacation')
const calendarEvents = computed(() =>
  state.events.map((eventItem) => ({
    ...eventItem,
    extendedProps: {
      ...eventItem.extendedProps,
    },
  })),
)

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: viewToFullCalendar[activeView.value] ?? 'dayGridMonth',
  initialDate: activeDate.value,
  events: calendarEvents.value,
  headerToolbar: false,
  weekends: true,
  dayMaxEvents: 3,
  nowIndicator: true,
  allDaySlot: true,
  scrollTime: '07:00:00',
  scrollTimeReset: false,
  stickyHeaderDates: true,
  slotMinTime: '00:00:00',
  slotMaxTime: '24:00:00',
  height: 'auto',
  dateClick: onDateClick,
  eventClick: onEventClick,
}))

function toLocalInputValue(date) {
  const value = new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hour = String(value.getHours()).padStart(2, '0')
  const minute = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function toDateOnly(value) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateTimeByDuration(start, durationHours) {
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) {
    return undefined
  }

  const endDate = new Date(startDate)
  endDate.setMinutes(endDate.getMinutes() + Math.round(Number(durationHours || 0) * 60))
  return toLocalInputValue(endDate)
}

function getCalendarApi() {
  return calendarRef.value?.getApi()
}

function setYearTitle() {
  title.value = String(activeDate.value.getFullYear())
}

function syncFromCalendar() {
  const api = getCalendarApi()
  if (!api) {
    return
  }

  activeDate.value = api.getDate()
  title.value = api.view.title

  nextTick(() => {
    scrollTimeGridToSevenAM()
  })
}

function scrollTimeGridToSevenAM() {
  if (activeView.value !== 'week' && activeView.value !== 'day') {
    return
  }

  const container = calendarContentRef.value
  if (!container) {
    return
  }

  const targetSlot = container.querySelector('.fc-timegrid-slot[data-time="07:00:00"]')
  if (!targetSlot) {
    return
  }

  container.scrollTop = targetSlot.offsetTop
}

async function changeView(nextView) {
  activeView.value = nextView

  if (nextView === 'year') {
    setYearTitle()
    return
  }

  fullCalendarKey.value += 1
  await nextTick()
  syncFromCalendar()
}

function shiftDateByView(direction) {
  const updatedDate = new Date(activeDate.value)

  if (activeView.value === 'year') {
    updatedDate.setFullYear(updatedDate.getFullYear() + direction)
  } else if (activeView.value === 'month') {
    updatedDate.setMonth(updatedDate.getMonth() + direction)
  } else if (activeView.value === 'week') {
    updatedDate.setDate(updatedDate.getDate() + direction * 7)
  } else {
    updatedDate.setDate(updatedDate.getDate() + direction)
  }

  activeDate.value = updatedDate
}

function previous() {
  if (isYearView.value) {
    shiftDateByView(-1)
    setYearTitle()
    return
  }

  const api = getCalendarApi()
  if (api) {
    api.prev()
    syncFromCalendar()
    return
  }

  shiftDateByView(-1)
}

function next() {
  if (isYearView.value) {
    shiftDateByView(1)
    setYearTitle()
    return
  }

  const api = getCalendarApi()
  if (api) {
    api.next()
    syncFromCalendar()
    return
  }

  shiftDateByView(1)
}

function today() {
  activeDate.value = new Date()

  if (isYearView.value) {
    setYearTitle()
    return
  }

  const api = getCalendarApi()
  if (api) {
    api.today()
    syncFromCalendar()
  }
}

function onYearDateSelect(date) {
  activeDate.value = date
  openCreateModal(date, true)
}

function openCreateModal(startDate = new Date(), allDay = true) {
  modalMode.value = 'create'
  modalInitialEvent.value = {
    title: '',
    start: toLocalInputValue(startDate),
    allDay,
    extendedProps: {
      type: defaultBucketType.value,
      hours: allDay ? state.settings.hoursPerDay : 1,
    },
  }
  modalOpen.value = true
}

function openEditModal(eventItem) {
  modalMode.value = 'edit'
  const type = eventItem.extendedProps?.type
  const validType =
    type === 'holiday' || state.settings.buckets.some((bucket) => bucket.key === type)
      ? type
      : defaultBucketType.value
  modalInitialEvent.value = {
    id: eventItem.id,
    title: eventItem.title,
    start: toLocalInputValue(eventItem.start || new Date()),
    allDay: eventItem.allDay,
    extendedProps: {
      type: validType,
      hours: Number(eventItem.extendedProps?.hours || state.settings.hoursPerDay),
    },
  }
  modalOpen.value = true
}

function onDateClick(info) {
  openCreateModal(info.date, info.allDay)
}

function onEventClick(info) {
  openEditModal({
    id: info.event.id,
    title: info.event.title,
    start: info.event.start,
    allDay: info.event.allDay,
    extendedProps: {
      ...info.event.extendedProps,
    },
  })
}

function closeModal() {
  modalOpen.value = false
  modalInitialEvent.value = null
}

function onSaveEvent(eventForm) {
  const rawEventType = eventForm.extendedProps?.type || defaultBucketType.value
  const eventType =
    rawEventType === 'holiday' || state.settings.buckets.some((bucket) => bucket.key === rawEventType)
      ? rawEventType
      : defaultBucketType.value
  const durationHours = Number(eventForm.extendedProps?.hours || state.settings.hoursPerDay)
  const normalizedStart = eventForm.allDay ? toDateOnly(eventForm.start) : eventForm.start
  const normalizedEnd = eventForm.allDay
    ? undefined
    : toDateTimeByDuration(eventForm.start, durationHours)

  upsertEvent({
    ...eventForm,
    id: eventForm.id || String(Date.now()),
    start: normalizedStart,
    end: normalizedEnd,
    color: ptoColors.value[eventType] || '#1a73e8',
    extendedProps: {
      ...eventForm.extendedProps,
      type: eventType,
      hours: durationHours,
    },
  })

  closeModal()
}

function onDeleteEvent(eventId) {
  deleteEvent(eventId)
  closeModal()
}

function onUpdateFiscalYearStart(month) {
  updateFiscalYearStartMonth(month)
}

function onUpdateBucketSize({ key, hours }) {
  updateBucketSize(key, hours)
}

function onUpdateHoursPerDay(hours) {
  updateHoursPerDay(hours)
}

function onUpdateShowHolidayTracker(value) {
  updateShowHolidayInTracker(value)
}

function onAddBucket(bucketDefinition) {
  addBucket(bucketDefinition)
}

function onRemoveBucket(bucketKey) {
  removeBucket(bucketKey)
}

function onClearEvents() {
  const shouldClear = window.confirm('Clear all calendar events? This cannot be undone.')
  if (!shouldClear) {
    return
  }

  clearEvents()
}

function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode) {
  const resolvedMode = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolvedMode)
}

function onSystemThemeChange() {
  if (state.settings.themeMode === 'system') {
    applyTheme('system')
  }
}

function onUpdateTheme(mode) {
  updateThemeMode(mode)
}

watch(
  () => state.settings.themeMode,
  (mode) => {
    applyTheme(mode)
  },
)

onMounted(() => {
  applyTheme(state.settings.themeMode)

  systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
  if (systemThemeMedia.addEventListener) {
    systemThemeMedia.addEventListener('change', onSystemThemeChange)
  } else if (systemThemeMedia.addListener) {
    systemThemeMedia.addListener(onSystemThemeChange)
  }
})

onBeforeUnmount(() => {
  if (!systemThemeMedia) {
    return
  }

  if (systemThemeMedia.removeEventListener) {
    systemThemeMedia.removeEventListener('change', onSystemThemeChange)
  } else if (systemThemeMedia.removeListener) {
    systemThemeMedia.removeListener(onSystemThemeChange)
  }
})

setYearTitle()
changeView('month')
</script>

<template>
  <main class="calendar-app">
    <div class="calendar-layout">
      <PtoTracker
        :current-fy="currentFy"
        :settings="state.settings"
        :active-balance="activeBalance"
        :usage-stats="usageStats"
        :events="state.events"
        @update-fiscal-year-start="onUpdateFiscalYearStart"
        @update-bucket-size="onUpdateBucketSize"
        @update-hours-per-day="onUpdateHoursPerDay"
        @update-show-holiday-tracker="onUpdateShowHolidayTracker"
        @add-bucket="onAddBucket"
        @remove-bucket="onRemoveBucket"
        @clear-events="onClearEvents"
      />

      <section class="calendar-main">
        <CalendarToolbar
          :active-view="activeView"
          :title="title"
          :theme-mode="state.settings.themeMode"
          @change-view="changeView"
          @change-theme="onUpdateTheme"
          @previous="previous"
          @next="next"
          @today="today"
        />

        <section ref="calendarContentRef" class="calendar-content">
          <YearView
            v-if="isYearView"
            :current-date="activeDate"
            :events="state.events"
            @select-date="onYearDateSelect"
          />

          <FullCalendar
            v-else
            :key="fullCalendarKey"
            ref="calendarRef"
            :options="calendarOptions"
          />
        </section>
      </section>
    </div>

    <EventModal
      :open="modalOpen"
      :mode="modalMode"
      :initial-event="modalInitialEvent"
      :hours-per-day="state.settings.hoursPerDay"
      :bucket-options="state.settings.buckets"
      @close="closeModal"
      @save="onSaveEvent"
      @delete="onDeleteEvent"
    />
  </main>
</template>
