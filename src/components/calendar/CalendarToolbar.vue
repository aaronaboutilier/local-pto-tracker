<script setup>
const props = defineProps({
  activeView: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  themeMode: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['change-view', 'previous', 'next', 'today', 'change-theme'])

const views = [
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
]

function onViewClick(viewKey) {
  emit('change-view', viewKey)
}
</script>

<template>
  <header class="calendar-toolbar">
    <div class="calendar-toolbar__left">
      <button class="toolbar-btn toolbar-btn--today" @click="emit('today')">Today</button>
      <div class="nav-btn-group">
        <button class="toolbar-btn" aria-label="Previous" @click="emit('previous')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="toolbar-btn" aria-label="Next" @click="emit('next')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <h1 class="calendar-title">{{ props.title }}</h1>
    </div>

    <div class="calendar-toolbar__right">
      <div class="view-toggle" role="tablist" aria-label="Calendar views">
        <button
          v-for="view in views"
          :key="view.key"
          class="toolbar-btn"
          :class="{ 'is-active': props.activeView === view.key }"
          role="tab"
          :aria-selected="props.activeView === view.key"
          @click="onViewClick(view.key)"
        >
          {{ view.label }}
        </button>
      </div>

      <select
        class="toolbar-btn theme-select"
        :value="props.themeMode"
        aria-label="Theme mode"
        @change="emit('change-theme', $event.target.value)"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  </header>
</template>
