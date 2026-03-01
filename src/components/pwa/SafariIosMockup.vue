<template>
  <div class="mockup">
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Phone frame -->
      <rect x="0" y="0" width="260" height="180" rx="16" fill="#111118" stroke="#2a2a3a" stroke-width="1"/>

      <!-- Status bar -->
      <text x="16" y="16" fill="#888" font-size="8" font-family="sans-serif">9:41</text>
      <text x="220" y="16" fill="#888" font-size="8" font-family="sans-serif">100%</text>

      <!-- Page content skeleton -->
      <g v-if="step === 0" opacity="0.4">
        <rect x="20" y="28" width="100" height="8" rx="3" fill="#2a2a3a"/>
        <rect x="20" y="44" width="220" height="6" rx="3" fill="#1e1e2c"/>
        <rect x="20" y="56" width="180" height="6" rx="3" fill="#1e1e2c"/>
        <rect x="20" y="68" width="200" height="6" rx="3" fill="#1e1e2c"/>
        <rect x="20" y="84" width="90" height="40" rx="6" fill="#1e1e2c"/>
        <rect x="120" y="84" width="90" height="40" rx="6" fill="#1e1e2c"/>
      </g>

      <!-- Bottom toolbar -->
      <rect x="0" y="145" width="260" height="35" fill="#161620" rx="0"/>
      <line x1="0" y1="145" x2="260" y2="145" stroke="#2a2a3a" stroke-width="0.5"/>

      <!-- Back arrow -->
      <text x="24" y="167" fill="#555" font-size="14" font-family="sans-serif">&lt;</text>
      <!-- Forward arrow -->
      <text x="58" y="167" fill="#555" font-size="14" font-family="sans-serif">&gt;</text>

      <!-- SHARE BUTTON - key highlight for step 0 -->
      <g :class="{ 'pulse-highlight': step === 0 }">
        <rect x="115" y="150" width="30" height="26" rx="6" :fill="step === 0 ? '#fb923c' : 'transparent'" :fill-opacity="step === 0 ? 0.2 : 0"/>
        <!-- Share icon (square with arrow up) -->
        <rect x="124" y="158" width="12" height="10" rx="2" fill="none" :stroke="step === 0 ? '#fdba74' : '#888'" stroke-width="1.2"/>
        <path d="M130 163 L130 153 M127 156 L130 153 L133 156" :stroke="step === 0 ? '#fdba74' : '#888'" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- Bookmark -->
      <text x="175" y="167" fill="#555" font-size="14" font-family="sans-serif">&#9744;</text>
      <!-- Tabs -->
      <text x="220" y="167" fill="#555" font-size="12" font-family="sans-serif">&#9634;</text>

      <!-- Step 0: pointer label -->
      <g v-if="step === 0" class="fade-in">
        <line x1="130" y1="143" x2="130" y2="134" stroke="#fdba74" stroke-width="1" stroke-dasharray="2,2"/>
        <rect x="80" y="115" width="100" height="20" rx="6" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5"/>
        <text x="96" y="129" fill="#fdba74" font-size="9" font-family="sans-serif">Tap Share</text>
      </g>

      <!-- Step 1: Share sheet mockup -->
      <g v-if="step === 1" class="fade-in">
        <rect x="0" y="60" width="260" height="120" rx="12" fill="#1e1e2c" stroke="#2a2a3a" stroke-width="0.5"/>
        <!-- Share sheet handle -->
        <rect x="115" y="66" width="30" height="3" rx="1.5" fill="#3a3a4e"/>

        <!-- Action row icons -->
        <rect x="18" y="82" width="40" height="40" rx="8" fill="#222230"/>
        <text x="28" y="106" fill="#888" font-size="7" font-family="sans-serif">Copy</text>

        <rect x="68" y="82" width="40" height="40" rx="8" fill="#222230"/>
        <text x="73" y="106" fill="#888" font-size="7" font-family="sans-serif">Markup</text>

        <rect x="118" y="82" width="40" height="40" rx="8" fill="#222230"/>
        <text x="125" y="106" fill="#888" font-size="7" font-family="sans-serif">Print</text>

        <!-- Add to Home Screen row -->
        <rect x="10" y="132" width="240" height="30" rx="8" fill="#fb923c" fill-opacity="0.12" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5" class="pulse-highlight"/>
        <rect x="18" y="138" width="18" height="18" rx="4" fill="#222" stroke="#fb923c" stroke-width="0.5"/>
        <text x="22" y="151" fill="#fdba74" font-size="10" font-family="sans-serif">+</text>
        <text x="44" y="151" fill="#fdba74" font-size="9" font-family="sans-serif">Add to Home Screen</text>
      </g>

      <!-- Step 2: Confirm dialog -->
      <g v-if="step === 2" class="fade-in">
        <rect x="20" y="40" width="220" height="100" rx="12" fill="#1e1e2c" stroke="#2a2a3a" stroke-width="0.5"/>
        <text x="55" y="62" fill="#e0e0f0" font-size="10" font-weight="bold" font-family="sans-serif">Add to Home Screen</text>
        <!-- App icon preview -->
        <rect x="100" y="72" width="28" height="28" rx="7" fill="#fb923c" opacity="0.3"/>
        <text x="108" y="91" fill="#fdba74" font-size="11" font-family="sans-serif">Z</text>
        <text x="93" y="110" fill="#888" font-size="8" font-family="sans-serif">ZapTracker</text>
        <!-- Add button -->
        <rect x="175" y="120" width="50" height="16" rx="8" fill="#fb923c" class="pulse-highlight"/>
        <text x="189" y="131" fill="#fff" font-size="8" font-weight="bold" font-family="sans-serif">Add</text>
        <!-- Cancel -->
        <text x="40" y="131" fill="#888" font-size="8" font-family="sans-serif">Cancel</text>
      </g>
    </svg>
    <p class="mockup-caption">Safari on iPhone / iPad</p>
  </div>
</template>

<script setup>
defineProps({
  step: { type: Number, default: 0 }
})
</script>

<style scoped>
.mockup {
  width: 100%;
  max-width: 260px;
}

.mockup svg {
  width: 100%;
  height: auto;
  border-radius: 12px;
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
    max-width: 220px;
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
