<template>
  <div class="mockup">
    <svg viewBox="0 0 420 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Browser window frame -->
      <rect x="0" y="0" width="420" height="180" rx="8" fill="#1a1a24" stroke="#2a2a3a" stroke-width="1"/>

      <!-- Tab bar -->
      <rect x="0" y="0" width="420" height="32" rx="8" fill="#111118"/>
      <rect x="0" y="24" width="420" height="8" fill="#111118"/>
      <!-- Active tab -->
      <rect x="8" y="6" width="120" height="26" rx="6" fill="#1a1a24"/>
      <circle cx="20" cy="19" r="5" fill="#fb923c" opacity="0.4"/>
      <text x="30" y="23" fill="#a0a0b8" font-size="9" font-family="sans-serif">ZapTracker</text>
      <text x="112" y="23" fill="#555" font-size="8" font-family="sans-serif">x</text>

      <!-- Address bar area -->
      <rect x="8" y="38" width="404" height="28" rx="14" fill="#111118" stroke="#2a2a3a" stroke-width="0.5"/>

      <!-- Nav arrows -->
      <text x="18" y="56" fill="#555" font-size="12" font-family="sans-serif">&lt;</text>
      <text x="30" y="56" fill="#555" font-size="12" font-family="sans-serif">&gt;</text>

      <!-- URL text -->
      <text x="52" y="55" fill="#888" font-size="10" font-family="monospace">
        <tspan fill="#6a6a80">https://</tspan>zaptracker.app
      </text>

      <!-- Star / bookmark icon -->
      <text x="375" y="57" fill="#555" font-size="13" font-family="sans-serif">&#9734;</text>

      <!-- THREE DOTS MENU - key highlight for step 0 -->
      <g :class="{ 'pulse-highlight': step === 0 }">
        <rect x="392" y="42" width="18" height="20" rx="4" :fill="step === 0 ? '#fb923c' : 'transparent'" :fill-opacity="step === 0 ? 0.2 : 0"/>
        <circle cx="401" cy="47" r="1.3" :fill="step === 0 ? '#fdba74' : '#555'"/>
        <circle cx="401" cy="52" r="1.3" :fill="step === 0 ? '#fdba74' : '#555'"/>
        <circle cx="401" cy="57" r="1.3" :fill="step === 0 ? '#fdba74' : '#555'"/>
      </g>

      <!-- Step 0: pointer label to three-dot menu -->
      <g v-if="step === 0" class="fade-in">
        <line x1="401" y1="66" x2="401" y2="78" stroke="#fdba74" stroke-width="1" stroke-dasharray="2,2"/>
        <rect x="320" y="80" width="96" height="22" rx="6" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5"/>
        <text x="332" y="95" fill="#fdba74" font-size="9" font-family="sans-serif">Click here (&#8942;)</text>
      </g>

      <!-- Page content skeleton (step 0 only) -->
      <g v-if="step === 0" opacity="0.3">
        <rect x="20" y="80" width="140" height="8" rx="3" fill="#2a2a3a"/>
        <rect x="20" y="95" width="200" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="108" width="170" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="121" width="100" height="6" rx="3" fill="#222230"/>
      </g>

      <!-- Step 1: Main settings dropdown with "Stream, save & share" highlighted -->
      <g v-if="step === 1" class="fade-in">
        <rect x="230" y="34" width="182" height="140" rx="6" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>

        <text x="245" y="53" fill="#a0a0b8" font-size="9" font-family="sans-serif">New Tab</text>
        <text x="245" y="68" fill="#a0a0b8" font-size="9" font-family="sans-serif">New Window</text>
        <text x="245" y="83" fill="#a0a0b8" font-size="9" font-family="sans-serif">New Incognito Window</text>
        <line x1="235" y1="89" x2="407" y2="89" stroke="#2a2a3a" stroke-width="0.5"/>
        <text x="245" y="104" fill="#a0a0b8" font-size="9" font-family="sans-serif">Bookmarks and Lists</text>
        <text x="400" y="104" fill="#555" font-size="8" font-family="sans-serif">&gt;</text>
        <text x="245" y="119" fill="#a0a0b8" font-size="9" font-family="sans-serif">History</text>
        <text x="400" y="119" fill="#555" font-size="8" font-family="sans-serif">&gt;</text>
        <text x="245" y="134" fill="#a0a0b8" font-size="9" font-family="sans-serif">Downloads</text>

        <!-- Stream, save & share - highlighted -->
        <rect x="235" y="140" width="172" height="18" rx="3" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5" class="pulse-highlight"/>
        <text x="245" y="153" fill="#fdba74" font-size="9" font-weight="bold" font-family="sans-serif">Stream, save &amp; share</text>
        <text x="400" y="153" fill="#fdba74" font-size="8" font-family="sans-serif">&gt;</text>

        <text x="245" y="168" fill="#a0a0b8" font-size="9" font-family="sans-serif">Extensions</text>
      </g>

      <!-- Step 2: Submenu with "Install page as app..." highlighted -->
      <g v-if="step === 2" class="fade-in">
        <!-- Main menu (faded) -->
        <rect x="230" y="34" width="182" height="140" rx="6" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5" opacity="0.4"/>
        <text x="245" y="53" fill="#a0a0b8" font-size="9" font-family="sans-serif" opacity="0.4">New Tab</text>
        <text x="245" y="68" fill="#a0a0b8" font-size="9" font-family="sans-serif" opacity="0.4">New Window</text>
        <text x="245" y="104" fill="#a0a0b8" font-size="9" font-family="sans-serif" opacity="0.4">Bookmarks and Lists</text>
        <text x="245" y="119" fill="#a0a0b8" font-size="9" font-family="sans-serif" opacity="0.4">History</text>
        <rect x="235" y="140" width="172" height="18" rx="3" fill="#fb923c" fill-opacity="0.08"/>
        <text x="245" y="153" fill="#fb923c" font-size="9" font-family="sans-serif" opacity="0.5">Stream, save &amp; share</text>
        <text x="400" y="153" fill="#fb923c" font-size="8" font-family="sans-serif" opacity="0.5">&gt;</text>

        <!-- Submenu -->
        <rect x="60" y="100" width="168" height="75" rx="6" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>
        <text x="75" y="119" fill="#a0a0b8" font-size="9" font-family="sans-serif">Cast...</text>
        <text x="75" y="134" fill="#a0a0b8" font-size="9" font-family="sans-serif">Save page as...</text>
        <text x="75" y="149" fill="#a0a0b8" font-size="9" font-family="sans-serif">Create QR code</text>

        <!-- Install page as app - highlighted -->
        <rect x="65" y="153" width="158" height="18" rx="3" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5" class="pulse-highlight"/>
        <text x="75" y="166" fill="#fdba74" font-size="9" font-weight="bold" font-family="sans-serif">Install page as app...</text>
      </g>
    </svg>
    <p class="mockup-caption">{{ browserLabel }} browser</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  step: { type: Number, default: 0 },
  browser: { type: String, default: 'chrome' }
})

const browserLabel = computed(() => {
  const labels = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera' }
  return labels[props.browser] || 'Chrome'
})
</script>

<style scoped>
.mockup {
  width: 100%;
  max-width: 380px;
}

.mockup svg {
  width: 100%;
  height: auto;
  border-radius: 8px;
  overflow: visible;
}

.mockup-caption {
  text-align: center;
  font-size: 0.7rem;
  color: #a8a29e;
  margin: 0.4rem 0 0;
}

@media (max-width: 480px) {
  .mockup {
    max-width: 100%;
  }
}

.pulse-highlight {
  animation: mockup-pulse 1.8s ease-in-out infinite;
}

.fade-in {
  animation: mockup-fade 0.3s ease-out;
}

@keyframes mockup-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes mockup-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
