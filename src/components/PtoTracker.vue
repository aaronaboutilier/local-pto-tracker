<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  currentFy: {
    type: String,
    required: true,
  },
  settings: {
    type: Object,
    required: true,
  },
  activeBalance: {
    type: Object,
    required: true,
  },
  usageStats: {
    type: Object,
    required: true,
  },
  events: {
    type: Array,
    required: true,
  },
})
const emit = defineEmits([
  'update-fiscal-year-start',
  'update-bucket-size',
  'update-hours-per-day',
  'update-show-holiday-tracker',
  'add-bucket',
  'remove-bucket',
  'clear-events',
])

const viewMode = ref('days')
const settingsOpen = ref(false)
const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const allocationBuckets = computed(() => props.settings.buckets || [])

const trackerBuckets = computed(() => {
  const baseBuckets = [...allocationBuckets.value]
  if (props.settings.showHolidayInTracker) {
    baseBuckets.push({ key: 'holiday', label: 'Holiday', color: '#F9AB00' })
  }
  return baseBuckets
})

function formatValue(hours) {
  const value = viewMode.value === 'hours' ? hours : hours / props.settings.hoursPerDay
  const normalizedValue = Number(value.toFixed(2))
  return `${normalizedValue}${viewMode.value === 'hours' ? ' h' : ' d'}`
}

function getUsedHours(key) {
  return Number(props.usageStats[key] || 0)
}

function getTotalHours(key) {
  return Number(props.activeBalance[key] || 0)
}

function getBucketSize(key) {
  return Number(props.settings.bucketSizes?.[key] ?? props.activeBalance[key] ?? 0)
}

function getBucketInputValue(key) {
  const hours = getBucketSize(key)
  if (viewMode.value === 'hours') {
    return Number(hours.toFixed(2))
  }

  return Number((hours / props.settings.hoursPerDay).toFixed(2))
}

function getPercentage(used, total) {
  if (!total) {
    return 0
  }

  return Math.min((used / total) * 100, 100)
}

function startOfDay(dateValue) {
  const date = new Date(dateValue)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getFiscalYearForDate(dateValue) {
  const date = new Date(dateValue)
  const startMonth = Number(props.settings.fiscalYearStartMonth || 0)
  return date.getMonth() < startMonth ? date.getFullYear() - 1 : date.getFullYear()
}

const holidayProgress = computed(() => {
  const fiscalYear = Number(props.currentFy)
  const today = startOfDay(new Date())

  let total = 0
  let passed = 0

  props.events.forEach((eventItem) => {
    const eventType = eventItem.extendedProps?.type
    if (eventType !== 'holiday' || !eventItem.start) {
      return
    }

    const eventDate = startOfDay(eventItem.start)
    if (getFiscalYearForDate(eventDate) !== fiscalYear) {
      return
    }

    total += 1
    if (eventDate < today) {
      passed += 1
    }
  })

  return {
    total,
    passed,
    left: Math.max(total - passed, 0),
  }
})

const bucketBreakdown = computed(() => {
  const fiscalYear = Number(props.currentFy)
  const today = startOfDay(new Date())
  const breakdownMap = {}

  allocationBuckets.value.forEach((bucket) => {
    breakdownMap[bucket.key] = {
      past: 0,
      planned: 0,
      unplanned: 0,
    }
  })

  props.events.forEach((eventItem) => {
    const eventType = eventItem.extendedProps?.type
    if (!eventType || !breakdownMap[eventType] || !eventItem.start) {
      return
    }

    const eventDate = startOfDay(eventItem.start)
    if (getFiscalYearForDate(eventDate) !== fiscalYear) {
      return
    }

    const eventHours = Number(eventItem.extendedProps?.hours || 0)
    if (eventDate < today) {
      breakdownMap[eventType].past += eventHours
    } else {
      breakdownMap[eventType].planned += eventHours
    }
  })

  allocationBuckets.value.forEach((bucket) => {
    const totalHours = getTotalHours(bucket.key)
    const usedHours = breakdownMap[bucket.key].past + breakdownMap[bucket.key].planned
    breakdownMap[bucket.key].unplanned = Math.max(totalHours - usedHours, 0)
  })

  return breakdownMap
})

function getBucketBreakdown(key) {
  return (
    bucketBreakdown.value[key] || {
      past: 0,
      planned: 0,
      unplanned: 0,
    }
  )
}

function isHolidayBucket(key) {
  return key === 'holiday'
}

function onFiscalYearStartChange(event) {
  emit('update-fiscal-year-start', Number(event.target.value))
}

function onBucketSizeChange(key, event) {
  const rawValue = Number(event.target.value)
  const normalizedValue = Number.isFinite(rawValue) ? Math.max(rawValue, 0) : 0
  const hours =
    viewMode.value === 'hours'
      ? normalizedValue
      : normalizedValue * props.settings.hoursPerDay

  emit('update-bucket-size', {
    key,
    hours,
  })
}

function onHoursPerDayChange(event) {
  const rawValue = Number(event.target.value)
  const normalizedValue = Number.isFinite(rawValue) ? Math.max(rawValue, 0.25) : props.settings.hoursPerDay
  emit('update-hours-per-day', normalizedValue)
}

function onShowHolidayToggle(event) {
  emit('update-show-holiday-tracker', event.target.checked)
}

const newBucketName = ref('')
const newBucketColor = ref('#1a73e8')

function toBucketKey(label) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'bucket'
  const existingKeys = allocationBuckets.value.map((bucket) => bucket.key)

  if (!existingKeys.includes(normalized)) {
    return normalized
  }

  let counter = 2
  let candidate = `${normalized}-${counter}`
  while (existingKeys.includes(candidate)) {
    counter += 1
    candidate = `${normalized}-${counter}`
  }

  return candidate
}

function onAddBucket() {
  const label = newBucketName.value.trim()
  if (!label) {
    return
  }

  const key = toBucketKey(label)
  emit('add-bucket', {
    key,
    label,
    color: newBucketColor.value || '#1a73e8',
  })

  newBucketName.value = ''
}

function onRemoveBucket(bucketKey) {
  if (allocationBuckets.value.length <= 1) {
    return
  }

  emit('remove-bucket', bucketKey)
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
}

function closeSettings() {
  settingsOpen.value = false
}
</script>

<template>
  <aside class="pto-tracker">
    <div class="pto-tracker__header">
      <h2 class="pto-tracker__title">FY{{ currentFy }} Tracker</h2>
      <button class="pto-gear-btn" aria-label="Open settings" @click="toggleSettings">⚙</button>
    </div>

    <div class="pto-buckets">
      <div class="pto-breakdown-header" aria-hidden="true">
        <span class="pto-breakdown-header__spacer"></span>
        <div class="pto-breakdown-header__labels">
          <span>Past</span>
          <span>Planned</span>
          <span>Unplanned</span>
        </div>
      </div>

      <div v-for="bucket in trackerBuckets" :key="bucket.key" class="pto-bucket-row">
        <div class="pto-bucket-row__top">
          <span class="pto-bucket-row__label" :style="{ color: bucket.color }">{{ bucket.label }}</span>
          <div v-if="!isHolidayBucket(bucket.key)" class="pto-breakdown-values">
            <span>{{ formatValue(getBucketBreakdown(bucket.key).past) }}</span>
            <span>{{ formatValue(getBucketBreakdown(bucket.key).planned) }}</span>
            <span>{{ formatValue(getBucketBreakdown(bucket.key).unplanned) }}</span>
          </div>
          <span v-else class="pto-bucket-row__value">
            {{ holidayProgress.passed }} passed • {{ holidayProgress.left }} left
          </span>
        </div>

        <div class="pto-progress">
          <div
            class="pto-progress__fill"
            :style="{
              width: `${
                isHolidayBucket(bucket.key)
                  ? getPercentage(holidayProgress.passed, holidayProgress.total)
                  : getPercentage(getUsedHours(bucket.key), getTotalHours(bucket.key))
              }%`,
              backgroundColor: bucket.color,
            }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="settingsOpen" class="settings-backdrop" @click.self="closeSettings">
      <section class="settings-modal" role="dialog" aria-modal="true" aria-label="PTO settings">
        <header class="settings-modal__header">
          <h3 class="settings-modal__title">Settings</h3>
          <button class="pto-gear-btn" aria-label="Close settings" @click="closeSettings">✕</button>
        </header>

        <div class="pto-setting">
          <p class="pto-setting-group__title">Display mode</p>
          <div class="pto-toggle">
            <button
              class="pto-toggle__btn"
              :class="{ 'is-active': viewMode === 'days' }"
              @click="viewMode = 'days'"
            >
              Days
            </button>
            <button
              class="pto-toggle__btn"
              :class="{ 'is-active': viewMode === 'hours' }"
              @click="viewMode = 'hours'"
            >
              Hours
            </button>
          </div>
        </div>

        <div class="pto-setting">
          <label class="pto-setting__label" for="hours-per-day">Work hours per day</label>
          <input
            id="hours-per-day"
            class="pto-setting__control"
            type="number"
            min="0.25"
            step="0.25"
            :value="settings.hoursPerDay"
            @change="onHoursPerDayChange"
          />
        </div>

        <div class="pto-setting">
          <label class="pto-setting__label" for="fy-start-month">Fiscal year starts</label>
          <select
            id="fy-start-month"
            class="pto-setting__control"
            :value="settings.fiscalYearStartMonth"
            @change="onFiscalYearStartChange"
          >
            <option v-for="(month, index) in monthOptions" :key="month" :value="index">
              {{ month }}
            </option>
          </select>
        </div>

        <label class="pto-setting pto-setting--checkbox" for="show-holiday-tracker">
          <span class="pto-setting__label">Show Holiday in tracker</span>
          <input
            id="show-holiday-tracker"
            type="checkbox"
            :checked="settings.showHolidayInTracker"
            @change="onShowHolidayToggle"
          />
        </label>

        <div class="pto-settings">
          <p class="pto-setting-group__title">
            Bucket allocations ({{ viewMode === 'hours' ? 'hours' : 'days' }})
          </p>
          <div
            v-for="bucket in allocationBuckets"
            :key="`allocation-${bucket.key}`"
            class="pto-setting pto-setting--bucket"
          >
            <div class="pto-bucket-row__top">
              <label class="pto-setting__label" :for="`allocation-${bucket.key}`">{{ bucket.label }}</label>
              <button
                class="bucket-remove-btn"
                :disabled="allocationBuckets.length <= 1"
                @click="onRemoveBucket(bucket.key)"
              >
                Remove
              </button>
            </div>
            <div class="pto-bucket-inputs">
              <input
                :id="`allocation-${bucket.key}`"
                class="pto-setting__control"
                type="number"
                min="0"
                :step="viewMode === 'hours' ? 0.5 : 0.25"
                :value="getBucketInputValue(bucket.key)"
                @change="onBucketSizeChange(bucket.key, $event)"
              />
              <span class="pto-bucket-color" :style="{ backgroundColor: bucket.color }" aria-hidden="true"></span>
            </div>
          </div>

          <div class="pto-setting pto-setting--bucket">
            <label class="pto-setting__label" for="new-bucket-name">Add bucket</label>
            <div class="pto-bucket-add">
              <input
                id="new-bucket-name"
                v-model="newBucketName"
                class="pto-setting__control"
                type="text"
                placeholder="Name"
              />
              <input v-model="newBucketColor" class="pto-setting__control pto-color-input" type="color" />
              <button class="bucket-add-btn" @click="onAddBucket">Add</button>
            </div>
          </div>
        </div>

        <div class="pto-settings-actions">
          <button class="toolbar-btn pto-clear-btn" @click="emit('clear-events')">Clear events</button>
        </div>
      </section>
    </div>
  </aside>
</template>
