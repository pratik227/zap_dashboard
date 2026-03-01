<template>
  <Teleport to="body">
    <Transition name="pwa-slide">
      <div v-if="isAuthenticated && showBanner" class="pwa-bar">
        <div class="pwa-bar-inner">
          <img src="/new_logo3.png" alt="" class="pwa-icon" />

          <div class="pwa-text">
            <span class="pwa-label">Install ZapTracker</span>
            <span class="pwa-desc">Use it like a native app</span>
          </div>

          <!-- Native prompt: single install button -->
          <button
            v-if="installInstructions.hasNativePrompt && deferredPrompt"
            class="pwa-btn pwa-btn--primary"
            @click="handleInstall"
          >
            Install
          </button>

          <!-- Manual: show guide toggle -->
          <button
            v-else
            class="pwa-btn pwa-btn--primary"
            @click="showGuide = !showGuide"
          >
            {{ showGuide ? 'Close' : 'Show me how' }}
          </button>

          <button class="pwa-close" @click="dismiss" aria-label="Dismiss">
            <IconX class="pwa-close-icon" />
          </button>
        </div>

        <!-- Expandable visual guide -->
        <Transition name="pwa-expand">
          <div v-if="showGuide" class="pwa-guide">
            <div class="pwa-guide-inner">

              <!-- Step-by-step with visual mockups -->
              <div class="pwa-guide-steps">
                <div
                  v-for="(step, i) in guideSteps"
                  :key="i"
                  class="pwa-guide-step"
                  :class="{ 'pwa-guide-step--active': activeStep === i }"
                  @click="activeStep = i"
                >
                  <span class="pwa-guide-step-num">{{ i + 1 }}</span>
                  <span class="pwa-guide-step-text">{{ step.text }}</span>
                </div>
              </div>

              <!-- Browser mockup for active step -->
              <div class="pwa-mockup-area">
                <!-- Chrome / Edge / Brave / Opera -->
                <template v-if="browserInfo.name === 'chrome' || browserInfo.name === 'edge' || browserInfo.name === 'brave' || browserInfo.name === 'opera'">
                  <ChromeBarMockup :step="activeStep" :browser="browserInfo.name" />
                </template>

                <!-- Safari iOS -->
                <template v-else-if="browserInfo.name === 'safari-ios'">
                  <SafariIosMockup :step="activeStep" />
                </template>

                <!-- Safari macOS -->
                <template v-else-if="browserInfo.name === 'safari-macos'">
                  <SafariMacMockup :step="activeStep" />
                </template>

                <!-- Firefox -->
                <template v-else-if="browserInfo.name === 'firefox'">
                  <FirefoxMockup :step="activeStep" />
                </template>

                <!-- Samsung / Arc / Unknown - generic -->
                <template v-else>
                  <GenericMockup :step="activeStep" :browser="browserInfo.name" />
                </template>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { IconX } from '@iconify-prerendered/vue-tabler'
import { usePwaInstall } from '../../composables/usePwaInstall'
import ChromeBarMockup from './ChromeBarMockup.vue'
import SafariIosMockup from './SafariIosMockup.vue'
import SafariMacMockup from './SafariMacMockup.vue'
import FirefoxMockup from './FirefoxMockup.vue'
import GenericMockup from './GenericMockup.vue'

const isAuthenticated = inject('isAuthenticated')

const {
  showBanner,
  browserInfo,
  installInstructions,
  deferredPrompt,
  promptInstall,
  dismiss
} = usePwaInstall()

const showGuide = ref(false)
const activeStep = ref(0)

// Reuse step text from composable installInstructions (single source of truth)
const guideSteps = computed(() => installInstructions.value.steps)

async function handleInstall() {
  await promptInstall()
}
</script>

<style scoped>
/* -- Bottom bar (always visible) -- */
.pwa-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #fffbf5;
  border-top: 1px solid #fed7aa;
  box-shadow: 0 -4px 24px rgba(251, 146, 60, 0.1);
  /* iOS safe area for home indicator */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.pwa-bar-inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1.25rem;
}

.pwa-icon {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.pwa-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.pwa-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1c1917;
  line-height: 1.2;
}

.pwa-desc {
  font-size: 0.75rem;
  color: #a8a29e;
  line-height: 1.2;
}

.pwa-btn {
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  transition: background 0.15s ease;
}

.pwa-btn--primary {
  background: #fb923c;
  color: #fff;
}

.pwa-btn--primary:hover {
  background: #f97316;
}

.pwa-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: #a8a29e;
  cursor: pointer;
  border-radius: 999px;
  transition: color 0.15s ease, background 0.15s ease;
}

.pwa-close:hover {
  color: #78716c;
  background: #fef3e2;
}

.pwa-close-icon {
  width: 16px;
  height: 16px;
}

/* -- Expandable guide panel -- */
.pwa-guide {
  border-top: 1px solid #fed7aa;
  overflow-y: auto;
  max-height: 60vh;
  -webkit-overflow-scrolling: touch;
}

.pwa-guide-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

/* -- Step list (left side on desktop, top on mobile) -- */
.pwa-guide-steps {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
  width: 280px;
}

.pwa-guide-step {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.pwa-guide-step:hover {
  background: #fef3e2;
}

.pwa-guide-step--active {
  background: rgba(251, 146, 60, 0.1);
}

.pwa-guide-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f5f0eb;
  color: #a8a29e;
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.15s ease;
}

.pwa-guide-step--active .pwa-guide-step-num {
  background: #fb923c;
  color: #fff;
}

.pwa-guide-step-text {
  font-size: 0.8rem;
  color: #78716c;
  line-height: 1.35;
  transition: color 0.15s ease;
}

.pwa-guide-step--active .pwa-guide-step-text {
  color: #1c1917;
}

/* -- Mockup area (right side on desktop, below on mobile) -- */
.pwa-mockup-area {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

/* -- Transitions -- */
.pwa-slide-enter-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.pwa-slide-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}

.pwa-slide-enter-from,
.pwa-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.pwa-expand-enter-active {
  transition: all 0.3s ease-out;
}

.pwa-expand-leave-active {
  transition: all 0.2s ease-in;
}

.pwa-expand-enter-from,
.pwa-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* -- Tablet -- */
@media (max-width: 768px) {
  .pwa-guide-inner {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
  }

  .pwa-guide-steps {
    width: 100%;
  }

  .pwa-mockup-area {
    width: 100%;
    justify-content: center;
  }
}

/* -- Phone -- */
@media (max-width: 480px) {
  .pwa-bar-inner {
    padding: 0.6rem 0.75rem;
    gap: 0.5rem;
  }

  .pwa-icon {
    width: 30px;
    height: 30px;
  }

  .pwa-label {
    font-size: 0.8rem;
  }

  .pwa-desc {
    font-size: 0.7rem;
  }

  .pwa-btn {
    font-size: 0.75rem;
    padding: 0.4rem 0.75rem;
  }

  .pwa-guide {
    max-height: 55vh;
  }

  .pwa-guide-inner {
    padding: 0.6rem 0.75rem 0.75rem;
    gap: 0.6rem;
  }

  .pwa-guide-step {
    padding: 0.4rem 0.5rem;
  }

  .pwa-guide-step-text {
    font-size: 0.75rem;
  }

  .pwa-guide-step-num {
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
  }
}
</style>
