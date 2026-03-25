<template>
  <div class="server-indicator" ref="wrapperRef">
    <!-- Trigger button -->
    <button class="indicator-trigger" @click="isOpen = !isOpen">
      <IconServer2 class="indicator-icon" />
      <span class="indicator-text">{{ servers.length }} server{{ servers.length !== 1 ? 's' : '' }}</span>
      <IconChevronUp v-if="isOpen" class="indicator-chevron" />
      <IconChevronDown v-else class="indicator-chevron" />
    </button>

    <!-- Popover -->
    <Transition name="popover">
      <div v-if="isOpen" class="indicator-popover">
        <div class="popover-header">
          <h4>Blossom Servers</h4>
        </div>

        <!-- Server list -->
        <div class="popover-list">
          <div v-for="(server, idx) in servers" :key="idx" class="popover-server">
            <span class="popover-host">{{ hostname(server) }}</span>
            <span v-if="isDefault(server)" class="popover-badge">Default</span>
            <button
              v-else
              class="popover-remove"
              title="Remove"
              @click="removeServer(idx)"
            >
              <IconX class="popover-remove-icon" />
            </button>
          </div>
        </div>

        <!-- Add server input -->
        <div class="popover-add">
          <input
            v-model="newServer"
            type="url"
            placeholder="https://server.example"
            class="popover-input"
            @keydown.enter="addServer"
          />
          <button class="popover-add-btn" :disabled="!isValidUrl" @click="addServer">
            <IconPlus class="popover-add-icon" />
          </button>
        </div>
        <p v-if="addError" class="popover-error">{{ addError }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IconServer2,
  IconChevronUp,
  IconChevronDown,
  IconX,
  IconPlus
} from '@iconify-prerendered/vue-tabler'
import { DEFAULT_BLOSSOM_SERVERS, getConfiguredServers, setConfiguredServers } from '../../services/blossomService.js'

const isOpen = ref(false)
const servers = ref([])
const newServer = ref('')
const addError = ref('')
const wrapperRef = ref(null)

onMounted(() => {
  servers.value = getConfiguredServers()
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

function onClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

const isValidUrl = computed(() => {
  try {
    const url = new URL(newServer.value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
})

function isDefault(server) {
  return DEFAULT_BLOSSOM_SERVERS.includes(server)
}

function hostname(server) {
  try { return new URL(server).hostname }
  catch { return server }
}

function addServer() {
  addError.value = ''
  if (!isValidUrl.value) { addError.value = 'Invalid URL'; return }

  const url = newServer.value.replace(/\/$/, '')
  if (servers.value.includes(url)) { addError.value = 'Already added'; return }

  servers.value.push(url)
  setConfiguredServers(servers.value)
  newServer.value = ''
}

function removeServer(idx) {
  servers.value.splice(idx, 1)
  setConfiguredServers(servers.value)
}
</script>

<style scoped>
.server-indicator {
  position: relative;
}

.indicator-trigger {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 0.375rem;
  color: #9ca3af;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.indicator-trigger:hover {
  border-color: rgba(0, 0, 0, 0.12);
  color: #6b7280;
  background: #f9fafb;
}

.indicator-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.indicator-chevron {
  width: 0.625rem;
  height: 0.625rem;
  opacity: 0.6;
}

.indicator-text {
  font-variant-numeric: tabular-nums;
}

/* Popover panel */
.indicator-popover {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 300px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  z-index: 50;
  overflow: hidden;
}

.popover-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.popover-header h4 {
  margin: 0;
  font-size: 0.875rem;
  color: #111827;
}

.popover-list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.popover-server {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  transition: background 0.15s ease;
}

.popover-server:hover { background: #f3f4f6; }

.popover-host {
  font-size: 0.8125rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-badge {
  font-size: 0.625rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background: #fff7ed;
  color: #f97316;
  font-weight: 600;
  flex-shrink: 0;
}

.popover-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  flex-shrink: 0;
}

.popover-remove:hover { background: #fef2f2; color: #ef4444; }
.popover-remove-icon { width: 0.75rem; height: 0.75rem; }

.popover-add {
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.popover-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  color: #111827;
  font-size: 0.8125rem;
  min-width: 0;
}

.popover-input:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }

.popover-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: #f97316;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.popover-add-btn:hover:not(:disabled) { background: #ea580c; }
.popover-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.popover-add-icon { width: 0.75rem; height: 0.75rem; }

.popover-error {
  color: #ef4444;
  font-size: 0.75rem;
  margin: 0;
  padding: 0 0.5rem 0.5rem;
}

.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 480px) {
  .indicator-popover {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 0.75rem 0.75rem 0 0;
  }
}
</style>
