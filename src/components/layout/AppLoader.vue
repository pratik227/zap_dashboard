<script setup>
import { ref, computed } from 'vue'
import { usePwaInstall } from '../../composables/usePwaInstall'
import ChromeBarMockup from '../pwa/ChromeBarMockup.vue'
import SafariIosMockup from '../pwa/SafariIosMockup.vue'
import SafariMacMockup from '../pwa/SafariMacMockup.vue'
import FirefoxMockup from '../pwa/FirefoxMockup.vue'
import GenericMockup from '../pwa/GenericMockup.vue'

const { showBanner: showPwa, browserInfo, installInstructions, deferredPrompt, promptInstall } = usePwaInstall()

const showPwaGuide = ref(false)
const pwaActiveStep = ref(0)

// Reuse step text from composable installInstructions (single source of truth)
const pwaGuideSteps = computed(() => installInstructions.value.steps)

async function handlePwaInstall() {
  await promptInstall()
}

const props = defineProps({
  phase: { type: String, default: 'session' },
  userName: { type: String, default: '' },
  userAvatar: { type: String, default: '' },
  timedOut: { type: Boolean, default: false },
  zapCount: { type: Number, default: 0 },
  noteCount: { type: Number, default: 0 },
  zapsLoading: { type: Boolean, default: false },
  notesLoading: { type: Boolean, default: false }
})

const phaseOrder = ['session', 'relays', 'profile', 'syncing', 'ready']

const currentIndex = computed(() => {
  const idx = phaseOrder.indexOf(props.phase)
  return idx === -1 ? 0 : idx
})

const greeting = computed(() => {
  if (props.userName && props.userName !== 'undefined') {
    return `Welcome back, ${props.userName}`
  }
  return 'Welcome back'
})

const progressPercent = computed(() => {
  // Base progress from phase
  const base = (currentIndex.value / (phaseOrder.length - 1)) * 100

  // During syncing, show granular progress based on data arriving
  if (props.phase === 'syncing') {
    const hasZaps = props.zapCount > 0
    const hasNotes = props.noteCount > 0
    const zapsDone = !props.zapsLoading
    const notesDone = !props.notesLoading

    // 60% = entered syncing, +10% per data source arriving, +10% per source finished
    let extra = 0
    if (hasZaps) extra += 10
    if (hasNotes) extra += 10
    if (zapsDone) extra += 10
    if (notesDone) extra += 10
    return Math.min(60 + extra, 95)
  }

  return Math.round(base)
})

const phaseLabel = computed(() => {
  if (props.timedOut) return 'Finishing up in the background'

  switch (props.phase) {
    case 'session': return 'Restoring your session'
    case 'relays': return 'Connecting to the network'
    case 'profile': return 'Loading your profile'
    case 'syncing': return syncLabel.value
    case 'ready': return 'All set!'
    default: return 'Loading'
  }
})

const syncLabel = computed(() => {
  const parts = []
  if (props.zapCount > 0) parts.push(`${props.zapCount} zaps`)
  if (props.noteCount > 0) parts.push(`${props.noteCount} notes`)

  if (parts.length > 0) {
    const still = (props.zapsLoading || props.notesLoading) ? 'Still syncing' : 'Wrapping up'
    return `${still} \u2014 found ${parts.join(', ')}`
  }

  return 'Fetching your data'
})

const phaseSub = computed(() => {
  switch (props.phase) {
    case 'session': return 'Checking your saved credentials'
    case 'relays': return 'Reaching out to Nostr relays'
    case 'profile': return 'Pulling in your latest info'
    case 'syncing': return props.zapCount === 0 && props.noteCount === 0
      ? 'This can take a few seconds'
      : ''
    case 'ready': return ''
    default: return ''
  }
})
</script>

<template>
  <div class="app-loader">
    <div class="loader-card">
      <!-- Logo + avatar + greeting -->
      <div class="header">
        <div class="header-icons">
          <img src="/new_logo3.png" alt="ZapTracker" class="logo" @error="$event.target.style.display = 'none'" />
          <img v-if="userAvatar" :src="userAvatar" alt="" class="avatar" @error="$event.target.style.display = 'none'" />
        </div>
        <div class="header-text">
          <p class="greeting">{{ greeting }}</p>
          <p class="sub">Setting things up&hellip;</p>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Phase status -->
      <div class="step-row">
        <div v-if="phase !== 'ready' && !timedOut" class="step-spinner"></div>
        <div v-else-if="phase === 'ready'" class="step-check">&#10003;</div>
        <div class="step-text">
          <span class="step-label">{{ phaseLabel }}</span>
          <span v-if="phaseSub" class="step-sub">{{ phaseSub }}</span>
        </div>
      </div>

      <!-- Live data counters during syncing -->
      <div v-if="phase === 'syncing' && (zapCount > 0 || noteCount > 0)" class="data-chips">
        <span v-if="zapCount > 0" class="chip">
          <span class="chip-icon">&#9889;</span>
          {{ zapCount }} zap{{ zapCount !== 1 ? 's' : '' }}
          <span v-if="zapsLoading" class="chip-dot"></span>
        </span>
        <span v-if="noteCount > 0" class="chip">
          <span class="chip-icon">&#9998;</span>
          {{ noteCount }} note{{ noteCount !== 1 ? 's' : '' }}
          <span v-if="notesLoading" class="chip-dot"></span>
        </span>
      </div>

      <!-- PWA Install hint (shown during loading while user waits) -->
      <div v-if="showPwa && (phase === 'syncing' || phase === 'relays' || phase === 'profile')" class="pwa-hint">
        <div class="pwa-hint-bar">
          <img src="/new_logo3.png" alt="" class="pwa-hint-icon" @error="$event.target.style.display = 'none'" />
          <span class="pwa-hint-text">Install ZapTracker as an app</span>
          <button
            v-if="installInstructions.hasNativePrompt && deferredPrompt"
            class="pwa-hint-btn"
            @click="handlePwaInstall"
          >Install</button>
          <button
            v-else
            class="pwa-hint-btn"
            @click="showPwaGuide = !showPwaGuide"
          >{{ showPwaGuide ? 'Hide' : 'Show me how' }}</button>
        </div>

        <!-- Inline mini guide -->
        <div v-if="showPwaGuide" class="pwa-hint-guide">
          <div class="pwa-hint-steps">
            <div
              v-for="(step, i) in pwaGuideSteps"
              :key="i"
              class="pwa-hint-step"
              :class="{ 'pwa-hint-step--active': pwaActiveStep === i }"
              @click="pwaActiveStep = i"
            >
              <span class="pwa-hint-step-num">{{ i + 1 }}</span>
              <span class="pwa-hint-step-label">{{ step.text }}</span>
            </div>
          </div>
          <div class="pwa-hint-mockup">
            <template v-if="browserInfo.name === 'chrome' || browserInfo.name === 'edge' || browserInfo.name === 'brave' || browserInfo.name === 'opera'">
              <ChromeBarMockup :step="pwaActiveStep" :browser="browserInfo.name" />
            </template>
            <template v-else-if="browserInfo.name === 'safari-ios'">
              <SafariIosMockup :step="pwaActiveStep" />
            </template>
            <template v-else-if="browserInfo.name === 'safari-macos'">
              <SafariMacMockup :step="pwaActiveStep" />
            </template>
            <template v-else-if="browserInfo.name === 'firefox'">
              <FirefoxMockup :step="pwaActiveStep" />
            </template>
            <template v-else>
              <GenericMockup :step="pwaActiveStep" :browser="browserInfo.name" />
            </template>
          </div>
        </div>
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
  gap: 1.25rem;
  padding: 2rem 2.25rem;
  max-width: 360px;
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
  align-items: flex-start;
  gap: 0.5rem;
}

.step-spinner {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  border: 2px solid #fed7aa;
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}

.step-check {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  font-size: 0.75rem;
  color: #16a34a;
  font-weight: 700;
  flex-shrink: 0;
  text-align: center;
  line-height: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.step-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.step-label {
  font-size: 0.8125rem;
  color: #44403c;
  font-weight: 500;
}

.step-sub {
  font-size: 0.6875rem;
  color: #a8a29e;
}

/* Live data chips */
.data-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.625rem;
  background: #fffbf5;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #78716c;
  font-variant-numeric: tabular-nums;
}

.chip-icon {
  font-size: 0.8125rem;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fb923c;
  animation: pulse-dot 1.2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* PWA Install hint */
.pwa-hint {
  border-top: 1px solid #fed7aa;
  padding-top: 1rem;
}

.pwa-hint-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pwa-hint-icon {
  width: 24px;
  height: 24px;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.pwa-hint-text {
  flex: 1;
  font-size: 0.75rem;
  color: #44403c;
  font-weight: 500;
}

.pwa-hint-btn {
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.3rem 0.75rem;
  background: #fb923c;
  color: #fff;
  transition: background 0.15s ease;
}

.pwa-hint-btn:hover {
  background: #f97316;
}

.pwa-hint-guide {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.pwa-hint-steps {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pwa-hint-step {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.pwa-hint-step:hover {
  background: #fef3e2;
}

.pwa-hint-step--active {
  background: rgba(251, 146, 60, 0.1);
}

.pwa-hint-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f5f0eb;
  color: #a8a29e;
  font-size: 0.6rem;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.pwa-hint-step--active .pwa-hint-step-num {
  background: #fb923c;
  color: #fff;
}

.pwa-hint-step-label {
  font-size: 0.7rem;
  color: #78716c;
  line-height: 1.3;
  transition: color 0.15s ease;
}

.pwa-hint-step--active .pwa-hint-step-label {
  color: #1c1917;
}

.pwa-hint-mockup {
  display: flex;
  justify-content: center;
}

.pwa-hint-mockup :deep(.mockup) {
  max-width: 280px;
}
</style>
