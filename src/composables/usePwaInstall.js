import { ref, computed } from 'vue'

const DISMISS_KEY = 'zaptracker-pwa-dismiss'
const DISMISS_DAYS = 7

// --- Module-scoped singleton state ---
const deferredPrompt = ref(null)
const isStandalone = ref(false)
const browserInfo = ref({ name: 'unknown', canPromptNatively: false })
const isDismissed = ref(false)
const isInstalled = ref(false)

// --- Browser Detection ---
function detectBrowser() {
  const ua = navigator.userAgent
  const vendor = navigator.vendor || ''

  // Order matters: more specific checks first
  if (ua.includes('SamsungBrowser')) {
    return { name: 'samsung', canPromptNatively: false }
  }
  if (ua.includes('Brave') || (navigator.brave && navigator.brave.isBrave)) {
    return { name: 'brave', canPromptNatively: true }
  }
  if (ua.includes('Arc')) {
    return { name: 'arc', canPromptNatively: false }
  }
  if (ua.includes('OPR') || ua.includes('Opera')) {
    return { name: 'opera', canPromptNatively: true }
  }
  if (ua.includes('Edg/')) {
    return { name: 'edge', canPromptNatively: true }
  }
  if (ua.includes('Firefox')) {
    return { name: 'firefox', canPromptNatively: false }
  }
  // Safari: has Safari in UA but NOT Chrome/Chromium
  if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) {
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    return {
      name: isIOS ? 'safari-ios' : 'safari-macos',
      canPromptNatively: false
    }
  }
  if (ua.includes('Chrome') && vendor.includes('Google')) {
    return { name: 'chrome', canPromptNatively: true }
  }

  return { name: 'unknown', canPromptNatively: false }
}

// --- Standalone Detection ---
function checkStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
}

// --- Dismissal Logic ---
function checkDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const dismissedAt = parseInt(raw, 10)
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return daysSince < DISMISS_DAYS
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, Date.now().toString())
  isDismissed.value = true
}

// --- Native Install Prompt ---
async function promptInstall() {
  if (!deferredPrompt.value) return false
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  if (outcome === 'accepted') {
    isInstalled.value = true
  }
  return outcome === 'accepted'
}

// --- Should show banner ---
const showBanner = computed(() => {
  return !isStandalone.value &&
    !isDismissed.value &&
    !isInstalled.value
})

// --- Browser-specific install instructions ---
const installInstructions = computed(() => {
  const instructions = {
    'chrome': {
      title: 'Get the ZapTracker App',
      subtitle: 'Install from the Chrome menu:',
      steps: [
        { text: 'Click the \u22EE menu (three dots) top right', icon: 'menu' },
        { text: 'Hover "Stream, save & share"', icon: 'chevron-right' },
        { text: 'Click "Install page as app..."', icon: 'download' }
      ],
      hasNativePrompt: false
    },
    'edge': {
      title: 'Get the ZapTracker App',
      subtitle: 'Install from the Edge menu:',
      steps: [
        { text: 'Click the \u22EF menu (three dots) top right', icon: 'menu' },
        { text: 'Hover "Apps"', icon: 'chevron-right' },
        { text: 'Click "Install this site as an app"', icon: 'download' }
      ],
      hasNativePrompt: false
    },
    'brave': {
      title: 'Get the ZapTracker App',
      subtitle: 'Install from the Brave menu:',
      steps: [
        { text: 'Click the \u2630 menu top right', icon: 'menu' },
        { text: 'Click "Install ZapTracker..."', icon: 'download' }
      ],
      hasNativePrompt: false
    },
    'opera': {
      title: 'Get the ZapTracker App',
      subtitle: 'Install from the Opera menu:',
      steps: [
        { text: 'Click Easy Setup menu top right', icon: 'menu' },
        { text: 'Click "Install page as app"', icon: 'download' }
      ],
      hasNativePrompt: false
    },
    'safari-ios': {
      title: 'Add ZapTracker to Your Home Screen',
      subtitle: "Here's how to get the app in seconds:",
      steps: [
        { text: 'Tap the Share button', icon: 'upload' },
        { text: "Scroll down and tap 'Add to Home Screen'", icon: 'plus' },
        { text: "Tap 'Add' \u2014 done!", icon: 'check' }
      ],
      hasNativePrompt: false
    },
    'safari-macos': {
      title: 'Add ZapTracker to Your Dock',
      subtitle: "Here's how to get the app in seconds:",
      steps: [
        { text: "Click 'File' in the menu bar", icon: 'menu' },
        { text: "Select 'Add to Dock...'", icon: 'plus' },
        { text: "Click 'Add' \u2014 that's it!", icon: 'check' }
      ],
      hasNativePrompt: false
    },
    'firefox': {
      title: 'Install ZapTracker as an App',
      subtitle: "Here's how to get the app in seconds:",
      steps: [
        { text: "Click the \u22EF menu in the address bar", icon: 'menu' },
        { text: "Select 'Install this site as an app'", icon: 'download' },
        { text: "Click 'Install' \u2014 you're all set!", icon: 'check' }
      ],
      hasNativePrompt: false
    },
    'samsung': {
      title: 'Add ZapTracker to Your Home Screen',
      subtitle: "Here's how to get the app in seconds:",
      steps: [
        { text: "Tap the menu \u2630 icon", icon: 'menu' },
        { text: "Tap 'Add page to' then 'Home screen'", icon: 'plus' },
        { text: "Confirm \u2014 done!", icon: 'check' }
      ],
      hasNativePrompt: false
    },
    'arc': {
      title: 'Install ZapTracker as an App',
      subtitle: "Here's how to get the app in seconds:",
      steps: [
        { text: 'Click the site icon in the URL bar', icon: 'world' },
        { text: "Select 'More Tools' then 'Create Shortcut'", icon: 'plus' },
        { text: "Check 'Open as window' and click 'Create'", icon: 'check' }
      ],
      hasNativePrompt: false
    },
    'unknown': {
      title: 'Get the ZapTracker App',
      subtitle: 'You can install ZapTracker right from your browser:',
      steps: [
        { text: "Look for an 'Install' or 'Add to Home Screen' option in your browser menu", icon: 'search' }
      ],
      hasNativePrompt: false
    }
  }

  return instructions[browserInfo.value.name] || instructions['unknown']
})

// --- Device type for messaging ---
const deviceType = computed(() => {
  const name = browserInfo.value.name
  if (name === 'safari-ios' || name === 'samsung') return 'phone'
  if (name === 'safari-macos') return 'Mac'
  return 'desktop'
})

// --- Eager initialization (module-scoped singleton) ---
// Runs once when first imported — no onMounted needed
function _init() {
  if (typeof window === 'undefined') return

  browserInfo.value = detectBrowser()
  isStandalone.value = checkStandalone()
  isDismissed.value = checkDismissed()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
  })

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    deferredPrompt.value = null
  })

  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', (e) => {
    isStandalone.value = e.matches
  })
}

_init()

export function usePwaInstall() {
  return {
    showBanner,
    browserInfo,
    installInstructions,
    deviceType,
    deferredPrompt,
    isStandalone,
    promptInstall,
    dismiss
  }
}
