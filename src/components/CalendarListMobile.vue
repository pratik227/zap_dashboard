<script setup>
import { ref } from 'vue'
import {
  IconPlus,
  IconX,
  IconEdit,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconCalendar,
  IconChevronUp
} from '@iconify-prerendered/vue-tabler'
import { useNostrCalendarList } from '../composables/useNostrCalendarList.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'create-calendar', 'edit-calendar'])

const {
  calendarLists,
  isCalendarSelected,
  toggleCalendarSelection,
  defaultCalendarId,
  setDefaultCalendar,
  deleteCalendarList
} = useNostrCalendarList()

const handleToggle = (d_tag) => {
  toggleCalendarSelection(d_tag)
}

const handleSetDefault = (d_tag) => {
  setDefaultCalendar(d_tag)
}

const handleEdit = (calendar) => {
  emit('edit-calendar', calendar)
}

const handleDelete = async (calendar) => {
  if (confirm(`Delete "${calendar.title}"? This will not delete the events in it.`)) {
    try {
      await deleteCalendarList(calendar.d_tag)
    } catch (error) {
      console.error('Failed to delete calendar:', error)
    }
  }
}

const handleCreateNew = () => {
  emit('create-calendar')
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="slide-up">
      <div
        v-if="show"
        class="fixed inset-0 z-[9998]"
        @click.self="handleClose"
      >
        <!-- Backdrop -->
        <div class="calendar-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleClose"></div>

        <!-- Bottom Sheet on Mobile, Dropdown Panel on Desktop -->
        <div class="calendar-modal-panel absolute sm:top-20 sm:left-6 sm:w-[420px] bottom-0 sm:bottom-auto left-0 right-0 sm:right-auto bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:border sm:border-gray-200/50 max-h-[85vh] sm:max-h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
          <!-- Drag Handle (Mobile Only) -->
          <div class="flex sm:hidden justify-center pt-3 pb-2">
            <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sm:bg-gradient-to-r sm:from-orange-50/50 sm:to-amber-50/30">
            <div class="flex items-center gap-2">
              <IconCalendar class="w-5 h-5 text-orange-600" />
              <h3 class="text-lg font-bold text-gray-900">My Calendars</h3>
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">
                {{ calendarLists.length }}
              </span>
            </div>
            <button
              @click="handleClose"
              class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <IconX class="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <!-- Calendar List -->
          <div class="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            <div v-if="calendarLists.length === 0" class="py-12 text-center">
              <IconCalendar class="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p class="text-sm text-gray-500 font-medium">No calendars yet</p>
              <p class="text-xs text-gray-400 mt-2">Create your first calendar to organize events</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="calendar in calendarLists"
                :key="calendar.d_tag"
                class="bg-gradient-to-br from-white to-gray-50/30 border border-gray-200/70 rounded-xl p-4 hover:shadow-md hover:border-orange-200/50 transition-all duration-200 group"
              >
                <div class="flex items-start gap-3">
                  <!-- Checkbox -->
                  <input
                    type="checkbox"
                    :checked="isCalendarSelected(calendar.d_tag)"
                    @change="handleToggle(calendar.d_tag)"
                    class="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 focus:ring-2"
                  />

                  <!-- Calendar Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <!-- Color indicator -->
                      <div
                        class="w-4 h-4 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: calendar.color }"
                      ></div>

                      <!-- Title and default indicator -->
                      <h4 class="text-base font-bold text-gray-900 truncate">
                        {{ calendar.title }}
                      </h4>

                      <button
                        @click="handleSetDefault(calendar.d_tag)"
                        :class="[
                          'flex-shrink-0 transition-colors',
                          defaultCalendarId === calendar.d_tag
                            ? 'text-yellow-500'
                            : 'text-gray-300'
                        ]"
                      >
                        <component :is="defaultCalendarId === calendar.d_tag ? IconStarFilled : IconStar" class="w-5 h-5" />
                      </button>
                    </div>

                    <!-- Description -->
                    <p v-if="calendar.description" class="text-sm text-gray-600 mb-2 line-clamp-2">
                      {{ calendar.description }}
                    </p>

                    <!-- Event count -->
                    <p class="text-xs text-gray-500">
                      {{ calendar.event_count || 0 }} events
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex flex-col gap-1">
                    <button
                      @click="handleEdit(calendar)"
                      class="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <IconEdit class="w-4 h-4" />
                    </button>
                    <button
                      @click="handleDelete(calendar)"
                      class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors"
                    >
                      <IconTrash class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 sm:p-5 border-t border-gray-200/70 bg-white sm:bg-gradient-to-r sm:from-gray-50/50 sm:to-white backdrop-blur-sm sm:rounded-b-2xl rounded-b-3xl">
            <button
              @click="handleCreateNew"
              class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3.5 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <IconPlus class="w-5 h-5" />
              Create New Calendar
            </button>

            <p v-if="calendarLists.length > 0" class="text-xs text-gray-500 text-center mt-3">
              {{ calendarLists.filter(c => isCalendarSelected(c.d_tag)).length }} of {{ calendarLists.length }} calendars visible
            </p>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Mobile: Slide up from bottom */
.slide-up-enter-from .calendar-modal-panel,
.slide-up-leave-to .calendar-modal-panel {
  transform: translateY(100%);
}

/* Desktop: Fade and scale */
@media (min-width: 640px) {
  .slide-up-enter-from .calendar-modal-panel,
  .slide-up-leave-to .calendar-modal-panel {
    transform: translateY(0) scale(0.95);
    opacity: 0;
  }

  .slide-up-enter-active .calendar-modal-panel,
  .slide-up-leave-active .calendar-modal-panel {
    transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
}

/* Backdrop fade */
.slide-up-enter-from .calendar-modal-backdrop,
.slide-up-leave-to .calendar-modal-backdrop {
  opacity: 0;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Line clamp */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
