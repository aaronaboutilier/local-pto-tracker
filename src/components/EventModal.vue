<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { parseDateInput, toDateOnlyString, toLocalInputValue } from '../utils'

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  mode: {
    type: String,
    default: 'create',
  },
  initialEvent: {
    type: Object,
    default: null,
  },
  hoursPerDay: {
    type: Number,
    default: 7.5,
  },
  bucketOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'save', 'delete'])

const titleInputRef = ref(null)
const validationError = ref('')
const startDateAnchor = ref('')
const isInitializingForm = ref(false)

const typeOptions = computed(() => [
  ...props.bucketOptions.map((bucket) => ({
    value: bucket.key,
    label: bucket.label || bucket.key,
  })),
  { value: 'holiday', label: 'Holiday' },
])

const form = reactive({
  id: '',
  title: '',
  start: '',
  end: '',
  allDay: true,
  type: 'vacation',
  hours: 7.5,
})

function toDateInputValue(value) {
  return toDateOnlyString(value)
}

function toInclusiveEndDate(endValue, startValue) {
  const fallbackStart = toDateInputValue(startValue)
  const endDate = parseDateInput(endValue)

  if (!endDate) {
    return fallbackStart
  }

  endDate.setDate(endDate.getDate() - 1)
  return toDateInputValue(endDate)
}

function fromEventToForm(eventItem) {
  isInitializingForm.value = true

  const type = eventItem.extendedProps?.type || typeOptions.value[0]?.value || 'vacation'
  const hours = Number(
    eventItem.extendedProps?.hours ?? (eventItem.allDay ? props.hoursPerDay : 1),
  )
  const isAllDay = Boolean(eventItem.allDay)
  const eventStart = eventItem.start || new Date()
  const startDate = toDateInputValue(eventStart)

  form.id = eventItem.id || ''
  form.title = eventItem.title || ''
  form.start = isAllDay ? startDate : toLocalInputValue(eventStart)
  form.end = isAllDay ? toInclusiveEndDate(eventItem.end, eventStart) : ''
  form.allDay = isAllDay
  startDateAnchor.value = startDate || toDateInputValue(new Date())
  const allowedTypes = typeOptions.value.map((option) => option.value)
  form.type = allowedTypes.includes(type) ? type : allowedTypes[0] || 'vacation'
  form.hours = Number.isFinite(hours) ? hours : props.hoursPerDay

  isInitializingForm.value = false
}

watch(
  () => form.allDay,
  (isAllDay, wasAllDay) => {
    if (isInitializingForm.value || isAllDay === wasAllDay) {
      return
    }

    if (isAllDay) {
      const normalizedStart =
        startDateAnchor.value || toDateInputValue(form.start) || toDateInputValue(new Date())
      form.start = normalizedStart
      form.end = toDateInputValue(form.end) || normalizedStart
      return
    }

    const anchoredDate = startDateAnchor.value || toDateInputValue(form.start)
    form.start = toLocalInputValue(parseDateInput(anchoredDate) || new Date())
    form.end = ''
  },
)

watch(
  () => [props.open, props.initialEvent],
  () => {
    if (!props.open) {
      return
    }

    validationError.value = ''

    if (props.initialEvent) {
      fromEventToForm(props.initialEvent)
    } else {
      fromEventToForm({
        title: '',
        start: toLocalInputValue(new Date()),
        allDay: true,
        extendedProps: {
          type: 'vacation',
          hours: props.hoursPerDay,
        },
      })
    }

    nextTick(() => {
      titleInputRef.value?.focus()
    })
  },
  { immediate: true },
)

function onSave() {
  if (!form.title.trim()) {
    validationError.value = 'Title is required'
    titleInputRef.value?.focus()
    return
  }

  if (!form.start) {
    validationError.value = 'Start date is required'
    return
  }

  if (form.allDay) {
    const normalizedStart = toDateInputValue(form.start)
    const normalizedEnd = toDateInputValue(form.end || form.start)

    if (!normalizedStart || !normalizedEnd) {
      validationError.value = 'Start and end dates are required for all-day events'
      return
    }

    if (normalizedEnd < normalizedStart) {
      validationError.value = 'End date cannot be before start date'
      return
    }

    validationError.value = ''
    emit('save', {
      id: form.id || undefined,
      title: form.title.trim(),
      start: normalizedStart,
      end: normalizedEnd,
      allDay: true,
      extendedProps: {
        type: form.type,
        hours: Number(form.hours),
      },
    })
    return
  }

  validationError.value = ''
  emit('save', {
    id: form.id || undefined,
    title: form.title.trim(),
    start: form.start,
    end: undefined,
    allDay: form.allDay,
    extendedProps: {
      type: form.type,
      hours: Number(form.hours),
    },
  })
}

function onDelete() {
  if (form.id) {
    emit('delete', form.id)
  }
}

const titleText = computed(() =>
  props.mode === 'edit' ? 'Edit Time-Off Event' : 'Create Time-Off Event',
)
</script>

<template>
  <Transition name="modal">
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')" @keydown.escape.window="emit('close')">
    <section class="event-modal" role="dialog" aria-modal="true" aria-label="Event editor">
      <h3 class="event-modal__title">{{ titleText }}</h3>

      <div class="event-modal__grid">
        <label class="event-field" :class="{ 'event-field--error': validationError && !form.title.trim() }">
          <span>Title</span>
          <input ref="titleInputRef" v-model="form.title" type="text" placeholder="PTO - Name" />
          <p v-if="validationError && !form.title.trim()" class="event-field__error">{{ validationError }}</p>
        </label>

        <label class="event-field">
          <span>{{ form.allDay ? 'Start date' : 'Start' }}</span>
          <input v-if="form.allDay" v-model="form.start" type="date" />
          <input v-else v-model="form.start" type="datetime-local" />
        </label>

        <label class="event-field event-field--checkbox">
          <input v-model="form.allDay" type="checkbox" />
          <span>All-day</span>
        </label>

        <label v-if="form.allDay" class="event-field">
          <span>End date</span>
          <input v-model="form.end" type="date" />
        </label>

        <label class="event-field">
          <span>Type</span>
          <select v-model="form.type">
            <option v-for="typeOption in typeOptions" :key="typeOption.value" :value="typeOption.value">
              {{ typeOption.label }}
            </option>
          </select>
        </label>

        <label class="event-field">
          <span>Duration (hours)</span>
          <input v-model.number="form.hours" type="number" min="0.25" step="0.25" />
        </label>
      </div>

      <footer class="event-modal__actions">
        <button v-if="mode === 'edit'" class="toolbar-btn event-modal__danger" @click="onDelete">Delete</button>
        <button class="toolbar-btn" @click="emit('close')">Cancel</button>
        <button class="toolbar-btn toolbar-btn--primary" @click="onSave">Save</button>
      </footer>
    </section>
  </div>
  </Transition>
</template>
