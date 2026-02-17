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
import {
  canUseFileSystemSync,
  getFileSystemSyncSupportMessage,
  hasFileReadWritePermission,
  ensureFileReadPermission,
  ensureFileReadWritePermission,
  persistSyncFileHandle,
  loadPersistedSyncFileHandle,
  openBackupFileForSync,
  openExistingBackupFileForRestore,
  writeBackupPayloadToFile,
  readBackupPayloadFromFile,
} from './services/fileSystemSync'

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
  getBackupPayload,
  importBackupPayload,
  ptoColors,
} = usePtoStore()

let systemThemeMedia = null
const FILE_SYNC_PREFS_KEY = 'local_pto_file_sync_v1'

const canSyncToFileSystem = ref(canUseFileSystemSync())
const fileSyncSupportMessage = ref(getFileSystemSyncSupportMessage())
const fileSyncEnabled = ref(false)
const fileSyncTargetName = ref('')
const fileSyncFileHandle = ref(null)
const lastFileSyncAt = ref('')
const syncStatus = ref('')
const syncError = ref('')
const FILE_SYNC_DEBOUNCE_MS = 700
let fileSyncTimer = null
let lastSyncedStateSnapshot = ''

const lastFileSyncAtLabel = computed(() => {
  if (!lastFileSyncAt.value) {
    return 'Never'
  }

  return new Date(lastFileSyncAt.value).toLocaleString()
})

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

function clearSyncMessages() {
  syncStatus.value = ''
  syncError.value = ''
}

async function withFileSyncGuard(work) {
  clearSyncMessages()

  try {
    if (!canSyncToFileSystem.value) {
      throw new Error('File system sync is not supported in this browser.')
    }

    await work()
  } catch (error) {
    syncError.value = error?.message || 'File system sync failed.'
  }
}

function clearFileSyncTimer() {
  if (fileSyncTimer) {
    window.clearTimeout(fileSyncTimer)
    fileSyncTimer = null
  }
}

function markLastFileSyncNow() {
  lastFileSyncAt.value = new Date().toISOString()
  persistFileSyncPrefs()
}

function getStateSnapshot() {
  return JSON.stringify(state)
}

function persistFileSyncPrefs() {
  const snapshot = {
    enabled: Boolean(fileSyncEnabled.value),
    targetName: fileSyncTargetName.value,
    lastFileSyncAt: lastFileSyncAt.value,
  }

  localStorage.setItem(FILE_SYNC_PREFS_KEY, JSON.stringify(snapshot))
}

function readFileSyncPrefs() {
  const raw = localStorage.getItem(FILE_SYNC_PREFS_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function restoreFileSyncSession() {
  const prefs = readFileSyncPrefs()
  if (!prefs) {
    return
  }

  if (prefs.lastFileSyncAt) {
    lastFileSyncAt.value = prefs.lastFileSyncAt
  }

  if (!prefs.enabled || !canSyncToFileSystem.value) {
    return
  }

  try {
    const persistedHandle = await loadPersistedSyncFileHandle()
    if (!persistedHandle) {
      fileSyncEnabled.value = false
      syncStatus.value = 'No saved sync file found. Use Enable file sync to choose a file again.'
      persistFileSyncPrefs()
      return
    }

    const hasAccess = await hasFileReadWritePermission(persistedHandle)
    fileSyncFileHandle.value = persistedHandle
    fileSyncTargetName.value = persistedHandle.name || prefs.targetName || 'selected backup file'
    fileSyncEnabled.value = true
    syncStatus.value = hasAccess
      ? `Resumed file sync: ${fileSyncTargetName.value}`
      : `Saved sync file found (${fileSyncTargetName.value}). Permission will be requested on next restore/sync.`
    persistFileSyncPrefs()
  } catch {
    fileSyncEnabled.value = false
    syncError.value = 'Unable to restore previous file sync session. Please enable sync again.'
    persistFileSyncPrefs()
  }
}

function disableFileSync() {
  clearFileSyncTimer()
  fileSyncEnabled.value = false
  syncStatus.value = 'Disabled file sync for this session.'
  syncError.value = ''
  persistFileSyncPrefs()
}

async function onEnableFileSync() {
  await withFileSyncGuard(async () => {
    const fileHandle = await openBackupFileForSync('pto-sync.json')
    fileSyncFileHandle.value = fileHandle
    fileSyncTargetName.value = fileHandle.name || 'selected backup file'
    fileSyncEnabled.value = true

    await persistSyncFileHandle(fileHandle)
    persistFileSyncPrefs()

    await writeBackupPayloadToFile(fileHandle, getBackupPayload())
    lastSyncedStateSnapshot = getStateSnapshot()
    markLastFileSyncNow()
    syncStatus.value = `File sync enabled: ${fileSyncTargetName.value}`
  })
}

async function onSyncToFileNow() {
  await withFileSyncGuard(async () => {
    if (!fileSyncEnabled.value || !fileSyncFileHandle.value) {
      throw new Error('Enable file sync first to choose a backup file.')
    }

    const hasPermission = await ensureFileReadWritePermission(fileSyncFileHandle.value)
    if (!hasPermission) {
      throw new Error('Write permission is required for the sync file.')
    }

    const payload = getBackupPayload()
    await writeBackupPayloadToFile(fileSyncFileHandle.value, payload)
    lastSyncedStateSnapshot = getStateSnapshot()
    markLastFileSyncNow()
    syncStatus.value = `Synced data to ${fileSyncTargetName.value}.`
  })
}

async function onRestoreFromFileSyncTarget() {
  await withFileSyncGuard(async () => {
    const restoreHandle = await openExistingBackupFileForRestore()

    const hasPermission = await ensureFileReadPermission(restoreHandle)
    if (!hasPermission) {
      throw new Error('Read permission is required for the sync file.')
    }

    const shouldRestore = window.confirm(
      'Restore from synced file and replace your current local data? This cannot be undone.',
    )
    if (!shouldRestore) {
      return
    }

    const payload = await readBackupPayloadFromFile(restoreHandle)
    importBackupPayload(payload)
    fileSyncFileHandle.value = restoreHandle
    fileSyncTargetName.value = restoreHandle.name || 'selected backup file'
    fileSyncEnabled.value = true
    await persistSyncFileHandle(restoreHandle)
    persistFileSyncPrefs()
    lastSyncedStateSnapshot = getStateSnapshot()
    markLastFileSyncNow()
    syncStatus.value = `Restored data from ${fileSyncTargetName.value}.`
  })
}

function queueFileAutoSync() {
  if (!fileSyncEnabled.value || !fileSyncFileHandle.value) {
    return
  }

  const nextSnapshot = getStateSnapshot()
  if (nextSnapshot === lastSyncedStateSnapshot) {
    return
  }

  clearFileSyncTimer()
  fileSyncTimer = window.setTimeout(async () => {
    try {
      const hasPermission = await hasFileReadWritePermission(fileSyncFileHandle.value)
      if (!hasPermission) {
        syncStatus.value = 'Sync file permission is not active. Use Sync now or Restore from file to re-authorize.'
        return
      }

      await writeBackupPayloadToFile(fileSyncFileHandle.value, getBackupPayload())
      lastSyncedStateSnapshot = nextSnapshot
      markLastFileSyncNow()
      syncStatus.value = `Auto-synced to ${fileSyncTargetName.value}.`
      syncError.value = ''
    } catch (error) {
      syncError.value = error?.message || 'Auto-sync failed.'
    }
  }, FILE_SYNC_DEBOUNCE_MS)
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

watch(state, queueFileAutoSync, { deep: true })

onMounted(() => {
  restoreFileSyncSession()
  applyTheme(state.settings.themeMode)

  systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
  if (systemThemeMedia.addEventListener) {
    systemThemeMedia.addEventListener('change', onSystemThemeChange)
  } else if (systemThemeMedia.addListener) {
    systemThemeMedia.addListener(onSystemThemeChange)
  }
})

onBeforeUnmount(() => {
  clearFileSyncTimer()

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
        :can-sync-to-file-system="canSyncToFileSystem"
        :file-sync-support-message="fileSyncSupportMessage"
        :file-sync-enabled="fileSyncEnabled"
        :file-sync-target-name="fileSyncTargetName"
        :last-file-sync-at-label="lastFileSyncAtLabel"
        :sync-status="syncStatus"
        :sync-error="syncError"
        @update-fiscal-year-start="onUpdateFiscalYearStart"
        @update-bucket-size="onUpdateBucketSize"
        @update-hours-per-day="onUpdateHoursPerDay"
        @update-show-holiday-tracker="onUpdateShowHolidayTracker"
        @add-bucket="onAddBucket"
        @remove-bucket="onRemoveBucket"
        @enable-file-sync="onEnableFileSync"
        @disable-file-sync="disableFileSync"
        @sync-to-file-now="onSyncToFileNow"
        @restore-from-file-sync-target="onRestoreFromFileSyncTarget"
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
