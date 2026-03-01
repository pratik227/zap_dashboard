<template>
  <div class="mockup">
    <svg viewBox="0 0 420 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Browser window frame -->
      <rect x="0" y="0" width="420" height="140" rx="8" fill="#1a1a24" stroke="#2a2a3a" stroke-width="1"/>

      <!-- Tab bar -->
      <rect x="0" y="0" width="420" height="32" rx="8" fill="#111118"/>
      <rect x="0" y="24" width="420" height="8" fill="#111118"/>
      <!-- Active tab -->
      <rect x="8" y="6" width="130" height="26" rx="6" fill="#1a1a24"/>
      <circle cx="20" cy="19" r="5" fill="#fb923c" opacity="0.4"/>
      <text x="30" y="23" fill="#a0a0b8" font-size="9" font-family="sans-serif">ZapTracker</text>

      <!-- Address bar -->
      <rect x="8" y="38" width="404" height="28" rx="6" fill="#111118" stroke="#2a2a3a" stroke-width="0.5"/>

      <!-- Shield icon -->
      <text x="18" y="56" fill="#555" font-size="11" font-family="sans-serif">&#128737;</text>

      <!-- URL text -->
      <text x="38" y="55" fill="#888" font-size="10" font-family="monospace">
        <tspan fill="#6a6a80">https://</tspan>zaptracker.app
      </text>

      <!-- PAGE ACTIONS MENU (...) - key highlight for step 0 -->
      <g :class="{ 'pulse-highlight': step === 0 }">
        <rect x="370" y="42" width="24" height="20" rx="4" :fill="step === 0 ? '#fb923c' : 'transparent'" :fill-opacity="step === 0 ? 0.2 : 0"/>
        <!-- Three dots horizontal -->
        <circle cx="377" cy="52" r="1.5" :fill="step === 0 ? '#fdba74' : '#666'"/>
        <circle cx="382" cy="52" r="1.5" :fill="step === 0 ? '#fdba74' : '#666'"/>
        <circle cx="387" cy="52" r="1.5" :fill="step === 0 ? '#fdba74' : '#666'"/>
      </g>

      <!-- Hamburger menu -->
      <g>
        <rect x="398" y="46" width="12" height="1.5" rx="0.75" fill="#555"/>
        <rect x="398" y="50.5" width="12" height="1.5" rx="0.75" fill="#555"/>
        <rect x="398" y="55" width="12" height="1.5" rx="0.75" fill="#555"/>
      </g>

      <!-- Step 0: pointer label -->
      <g v-if="step === 0" class="fade-in">
        <line x1="382" y1="66" x2="382" y2="78" stroke="#fdba74" stroke-width="1" stroke-dasharray="2,2"/>
        <rect x="312" y="80" width="140" height="20" rx="6" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5"/>
        <text x="324" y="94" fill="#fdba74" font-size="9" font-family="sans-serif">Click this menu (&#8943;)</text>
      </g>

      <!-- Step 1: Dropdown menu -->
      <g v-if="step === 1" class="fade-in">
        <rect x="270" y="38" width="142" height="95" rx="6" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>

        <text x="285" y="57" fill="#a0a0b8" font-size="9" font-family="sans-serif">Bookmark This Page</text>
        <text x="285" y="72" fill="#a0a0b8" font-size="9" font-family="sans-serif">Save Page As...</text>
        <line x1="275" y1="78" x2="407" y2="78" stroke="#2a2a3a" stroke-width="0.5"/>

        <!-- Install option - highlighted -->
        <rect x="275" y="82" width="132" height="18" rx="3" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c" stroke-opacity="0.3" stroke-width="0.5" class="pulse-highlight"/>
        <text x="285" y="95" fill="#fdba74" font-size="9" font-weight="bold" font-family="sans-serif">Install this site as an app</text>

        <line x1="275" y1="104" x2="407" y2="104" stroke="#2a2a3a" stroke-width="0.5"/>
        <text x="285" y="119" fill="#a0a0b8" font-size="9" font-family="sans-serif">Send Page to Device</text>
      </g>

      <!-- Step 2: Install confirm -->
      <g v-if="step === 2" class="fade-in">
        <rect x="110" y="35" width="200" height="95" rx="8" fill="#1e1e2c" stroke="#3a3a4e" stroke-width="0.5"/>
        <text x="145" y="57" fill="#e0e0f0" font-size="10" font-weight="bold" font-family="sans-serif">Install ZapTracker?</text>
        <!-- App preview -->
        <rect x="188" y="67" width="24" height="24" rx="6" fill="#fb923c" opacity="0.3"/>
        <text x="196" y="84" fill="#fdba74" font-size="10" font-family="sans-serif">Z</text>
        <text x="173" y="101" fill="#888" font-size="8" font-family="sans-serif">zaptracker.app</text>
        <!-- Buttons -->
        <rect x="195" y="108" width="50" height="18" rx="9" fill="transparent" stroke="#444" stroke-width="0.5"/>
        <text x="208" y="120" fill="#888" font-size="8" font-family="sans-serif">Cancel</text>
        <rect x="252" y="108" width="46" height="18" rx="9" fill="#fb923c" class="pulse-highlight"/>
        <text x="262" y="120" fill="#fff" font-size="8" font-weight="bold" font-family="sans-serif">Install</text>
      </g>

      <!-- Page content skeleton -->
      <g v-if="step === 0" opacity="0.3">
        <rect x="20" y="80" width="140" height="8" rx="3" fill="#2a2a3a"/>
        <rect x="20" y="95" width="200" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="108" width="170" height="6" rx="3" fill="#222230"/>
        <rect x="20" y="121" width="100" height="6" rx="3" fill="#222230"/>
      </g>
    </svg>
    <p class="mockup-caption">Firefox browser</p>
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
