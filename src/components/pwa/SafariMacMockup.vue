<template>
  <div class="mockup">
    <svg viewBox="0 0 420 150" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Browser window frame -->
      <rect x="0" y="0" width="420" height="150" rx="8" fill="#1a1a24" stroke="#2a2a3a" stroke-width="1"/>

      <!-- macOS menu bar -->
      <rect x="0" y="0" width="420" height="22" rx="8" fill="#0d0d12"/>
      <rect x="0" y="14" width="420" height="8" fill="#0d0d12"/>
      <!-- Traffic lights -->
      <circle cx="14" cy="11" r="4" fill="#ff5f57"/>
      <circle cx="28" cy="11" r="4" fill="#ffbd2e"/>
      <circle cx="42" cy="11" r="4" fill="#28c840"/>

      <!-- Menu bar items -->
      <text x="65" y="15" fill="#888" font-size="9" font-weight="bold" font-family="sans-serif">Safari</text>

      <!-- FILE menu - key highlight for step 0 -->
      <g :class="{ 'pulse-highlight': step === 0 }">
        <rect x="99" y="2" width="26" height="18" rx="3" :fill="step === 0 ? '#fb923c' : 'transparent'" :fill-opacity="step === 0 ? 0.25 : 0"/>
        <text x="103" y="15" :fill="step === 0 ? '#fdba74' : '#888'" font-size="9" font-family="sans-serif">File</text>
      </g>

      <text x="135" y="15" fill="#888" font-size="9" font-family="sans-serif">Edit</text>
      <text x="160" y="15" fill="#888" font-size="9" font-family="sans-serif">View</text>
      <text x="188" y="15" fill="#888" font-size="9" font-family="sans-serif">History</text>

      <!-- Address bar -->
      <rect x="8" y="28" width="404" height="26" rx="6" fill="#111118"/>
      <!-- URL -->
      <text x="170" y="45" fill="#888" font-size="9" font-family="sans-serif" text-anchor="middle">zaptracker.app</text>

      <!-- Step 0: pointer label -->
      <g v-if="step === 0" class="fade-in">
        <line x1="112" y1="22" x2="112" y2="62" stroke="#fdba74" stroke-width="1" stroke-dasharray="2,2"/>
        <rect x="62" y="64" width="100" height="20" rx="6" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5"/>
        <text x="73" y="78" fill="#fdba74" font-size="9" font-family="sans-serif">Click "File"</text>
      </g>

      <!-- Step 1: File dropdown menu -->
      <g v-if="step === 1" class="fade-in">
        <rect x="95" y="22" width="150" height="120" rx="6" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>

        <text x="110" y="40" fill="#a0a0b8" font-size="9" font-family="sans-serif">New Window</text>
        <text x="110" y="55" fill="#a0a0b8" font-size="9" font-family="sans-serif">New Private Window</text>
        <line x1="100" y1="62" x2="240" y2="62" stroke="#2a2a3a" stroke-width="0.5"/>
        <text x="110" y="77" fill="#a0a0b8" font-size="9" font-family="sans-serif">Open File...</text>
        <text x="110" y="92" fill="#a0a0b8" font-size="9" font-family="sans-serif">Close Window</text>
        <line x1="100" y1="99" x2="240" y2="99" stroke="#2a2a3a" stroke-width="0.5"/>

        <!-- Add to Dock - highlighted -->
        <rect x="100" y="104" width="140" height="18" rx="3" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5" class="pulse-highlight"/>
        <text x="110" y="117" fill="#fdba74" font-size="9" font-weight="bold" font-family="sans-serif">Add to Dock...</text>

        <text x="110" y="137" fill="#a0a0b8" font-size="9" font-family="sans-serif">Share...</text>
      </g>

      <!-- Step 2: Confirm dialog -->
      <g v-if="step === 2" class="fade-in">
        <rect x="110" y="45" width="200" height="90" rx="8" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>
        <text x="150" y="67" fill="#e0e0f0" font-size="10" font-weight="bold" font-family="sans-serif">Add to Dock</text>
        <!-- App icon -->
        <rect x="188" y="75" width="24" height="24" rx="6" fill="#fb923c" opacity="0.3"/>
        <text x="196" y="92" fill="#fdba74" font-size="10" font-family="sans-serif">Z</text>
        <!-- Buttons -->
        <rect x="195" y="110" width="50" height="18" rx="9" fill="transparent" stroke="#444" stroke-width="0.5"/>
        <text x="208" y="123" fill="#888" font-size="8" font-family="sans-serif">Cancel</text>
        <rect x="252" y="110" width="46" height="18" rx="9" fill="#fb923c" class="pulse-highlight"/>
        <text x="267" y="123" fill="#fff" font-size="8" font-weight="bold" font-family="sans-serif">Add</text>
      </g>

      <!-- Page content skeleton (when no overlays) -->
      <g v-if="step === 0" opacity="0.3">
        <rect x="20" y="68" width="140" height="8" rx="3" fill="#2a2a3a"/>
        <rect x="20" y="84" width="200" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="96" width="160" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="108" width="120" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="124" width="80" height="24" rx="6" fill="#222230"/>
      </g>
    </svg>
    <p class="mockup-caption">Safari on macOS</p>
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
