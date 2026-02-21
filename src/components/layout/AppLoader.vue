<script setup>
import { computed } from 'vue'

const props = defineProps({
  phase: { type: String, default: 'session' },
  userName: { type: String, default: '' },
  userAvatar: { type: String, default: '' }
})

const steps = [
  { key: 'session', label: 'Restoring session' },
  { key: 'relays', label: 'Connecting to relays' },
  { key: 'profile', label: 'Loading profile' },
  { key: 'syncing', label: 'Syncing data' },
  { key: 'ready', label: 'Almost ready' }
]

const phaseOrder = ['session', 'relays', 'profile', 'syncing', 'ready']

const currentIndex = computed(() => {
  const idx = phaseOrder.indexOf(props.phase)
  return idx === -1 ? 0 : idx
})

const stepState = (stepKey) => {
  const stepIdx = phaseOrder.indexOf(stepKey)
  if (stepIdx < currentIndex.value) return 'done'
  if (stepIdx === currentIndex.value) return 'active'
  return 'pending'
}

const greeting = computed(() => {
  if (props.userName && props.userName !== 'undefined') {
    return `Welcome back, ${props.userName}`
  }
  return 'Welcome back'
})

const progressPercent = computed(() => {
  return Math.round(((currentIndex.value + 1) / phaseOrder.length) * 100)
})
</script>

<template>
  <div class="app-loader">
    <div class="loader-card">
      <!-- Logo + avatar + greeting row -->
      <div class="header">
        <div class="header-icons">
          <img src="/new_logo3.png" alt="ZapTracker" class="logo" />
          <img v-if="userAvatar" :src="userAvatar" alt="" class="avatar" />
        </div>
        <div class="header-text">
          <p class="greeting">{{ greeting }}</p>
          <p class="sub">Setting things up&hellip;</p>
        </div>
      </div>

      <!-- Minimal progress bar -->
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Current step label -->
      <div class="step-row">
        <div class="step-spinner"></div>
        <span class="step-label">{{ steps[currentIndex]?.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #fffbf5 0%, #fff7ed 50%, #fef3e2 100%);
}

.loader-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem 2.25rem;
  max-width: 340px;
  width: 100%;
  background: white;
  border-radius: 1rem;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 8px 32px rgba(251, 146, 60, 0.08);
  border: 1px solid rgba(251, 146, 60, 0.1);
}

/* Header */
.header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.header-icons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.logo {
  width: 44px;
  height: 44px;
  border-radius: 0.625rem;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fed7aa;
}

.header-text {
  min-width: 0;
}

.greeting {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1c1917;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 0.8125rem;
  color: #a8a29e;
  margin-top: 0.125rem;
}

/* Progress bar */
.progress-track {
  width: 100%;
  height: 3px;
  background: #f5f0eb;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fb923c, #f97316);
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Step row */
.step-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.step-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #fed7aa;
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.step-label {
  font-size: 0.8125rem;
  color: #78716c;
}
</style>
