// Refresh cycle utility — periodic data refresh for composables
// Pure JS, no Vue dependency

const callbacks = new Map() // name → { fn, intervalMs }
let cycleTimer = null
let warmupTimer = null

const CYCLE_INTERVAL = 120_000 // 2 minutes between cycles
const WARMUP_DELAY = 30_000   // 30s warmup before first cycle
const STAGGER_DELAY = 5_000   // 5s between callbacks within a cycle

/**
 * Register a refresh callback.
 * @param {string} name — unique identifier
 * @param {Function} fn — async refresh function
 */
export function registerRefresh(name, fn) {
  callbacks.set(name, { fn })
  console.log(`[refreshCycle] Registered: ${name}`)
}

/**
 * Unregister a refresh callback.
 * @param {string} name
 */
export function unregisterRefresh(name) {
  callbacks.delete(name)
  console.log(`[refreshCycle] Unregistered: ${name}`)
}

/**
 * Run one cycle — staggers callbacks by STAGGER_DELAY.
 */
async function runCycle() {
  const entries = Array.from(callbacks.entries())
  if (entries.length === 0) return

  console.log(`[refreshCycle] Running cycle (${entries.length} callbacks)`)

  for (let i = 0; i < entries.length; i++) {
    const [name, { fn }] = entries[i]

    // Stagger: wait before each callback (skip first)
    if (i > 0) {
      await new Promise(r => setTimeout(r, STAGGER_DELAY))
    }

    try {
      await fn()
      console.log(`[refreshCycle] ${name} refreshed`)
    } catch (err) {
      console.warn(`[refreshCycle] ${name} failed:`, err.message)
    }
  }
}

/**
 * Start the refresh cycle.
 * Waits WARMUP_DELAY before first cycle, then repeats every CYCLE_INTERVAL.
 */
export function startRefreshCycle() {
  stopRefreshCycle()

  warmupTimer = setTimeout(() => {
    warmupTimer = null
    runCycle()
    cycleTimer = setInterval(runCycle, CYCLE_INTERVAL)
  }, WARMUP_DELAY)

  console.log(`[refreshCycle] Started (warmup ${WARMUP_DELAY / 1000}s, interval ${CYCLE_INTERVAL / 1000}s)`)
}

/**
 * Stop the refresh cycle.
 */
export function stopRefreshCycle() {
  if (warmupTimer) {
    clearTimeout(warmupTimer)
    warmupTimer = null
  }
  if (cycleTimer) {
    clearInterval(cycleTimer)
    cycleTimer = null
  }
}
