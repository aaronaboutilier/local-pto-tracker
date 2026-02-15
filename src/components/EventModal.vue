<script setup>
import { computed, reactive, watch } from 'vue'

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
  allDay: true,
  type: 'vacation',
  hours: 7.5,
})

function toLocalInputValue(date) {
  const value = new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hour = String(value.getHours()).padStart(2, '0')
  const minute = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function fromEventToForm(eventItem) {
  const type = eventItem.extendedProps?.type || typeOptions.value[0]?.value || 'vacation'
  const hours = Number(
    eventItem.extendedProps?.hours ?? (eventItem.allDay ? props.hoursPerDay : 1),
  )

  form.id = eventItem.id || ''
  form.title = eventItem.title || ''
  form.start = eventItem.start || toLocalInputValue(new Date())
  form.allDay = Boolean(eventItem.allDay)
  const allowedTypes = typeOptions.value.map((option) => option.value)
  form.type = allowedTypes.includes(type) ? type : allowedTypes[0] || 'vacation'
  form.hours = Number.isFinite(hours) ? hours : props.hoursPerDay
}

watch(
  () => [props.open, props.initialEvent],
  () => {
    if (!props.open) {
      return
    }

    if (props.initialEvent) {
      fromEventToForm(props.initialEvent)
      return
    }

    fromEventToForm({
      title: '',
      start: toLocalInputValue(new Date()),
      allDay: true,
      extendedProps: {
        type: 'vacation',
        hours: props.hoursPerDay,
      },
    })
  },
  { immediate: true },
)

function onSave() {
  if (!form.title.trim() || !form.start) {
    return
  }

  emit('save', {
    id: form.id || undefined,
    title: form.title.trim(),
    start: form.start,
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
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section class="event-modal" role="dialog" aria-modal="true" aria-label="Event editor">
      <h3 class="event-modal__title">{{ titleText }}</h3>

      <div class="event-modal__grid">
        <label class="event-field">
          <span>Title</span>
          <input v-model="form.title" type="text" placeholder="PTO - Name" />
        </label>

        <label class="event-field">
          <span>Start</span>
          <input v-model="form.start" type="datetime-local" />
        </label>

        <label class="event-field event-field--checkbox">
          <input v-model="form.allDay" type="checkbox" />
          <span>All-day</span>
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
</template>
