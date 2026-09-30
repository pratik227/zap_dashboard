# ZapTracker nostr-core Revamp Roadmap

## Why

ZapTracker has nostr-core installed but only half-wired. The outbox model code exists but has zero callers. Every feature blasts to all relays. But the deeper problem is **user experience**: relay disconnects kill sessions silently, failed publishes have no retry, wallet timeouts show nothing for 30 seconds, errors go to the console instead of the screen, and large datasets have no pagination. This revamp makes ZapTracker reliable to use, not just clean to read.

**Core principle:** Build as much as possible with nostr-core. Replace every manual implementation with the library's tested helpers.

---

## Step 1: Reliability First -- Make What Exists Work Properly (100% DONE)

Before touching architecture, fix what breaks the experience today.

### Relay resilience
- [x] Auto-reconnect when a relay disconnects mid-session
- [x] Re-open affected subscriptions after reconnect
- [x] Show relay health indicator so users know connection state
- [x] With 0 relays: show cached data + "offline" indicator instead of hanging 25s

### Publish feedback & retry
- [x] Show error AND retry button when publishing a note/campaign/DM fails
- [~] Preserve user input on failure (don't make them re-type) *(reactivity preserves state, not verified in all UI paths)*

### Wallet connection
- [x] Add progress/waiting indicator for NWC timeout (30s countdown in connect button)
- [x] Periodic background retry for wallet reconnection (60s interval via startBackgroundReconnect)
- [x] Show clear wallet status at all times (connected / reconnecting / disconnected)

### Loading & empty states
- [~] Dashboard: skeleton loader while chart loads (currently blank) *(Analytics has skeleton, Dashboard uses LoadingStateDashboard)*
- [~] Notes: show "Loading... X notes found" instead of spinner (for 500+ notes) *(SkeletonList used, no progressive count)*
- [x] Wallet: show partial state clearly when balance fetch fails but transactions load

### Data completeness
- [x] Add "Load More" or "Showing X of Y" when data is capped at 500
- [x] Pagination or virtual scroll for large follow lists (500+)

**Why first:** Users don't care about outbox models -- they care that things load, errors are visible, and actions can be retried.

---

## Step 2: Single Source of Truth (100% DONE)

- [x] Move all relay URLs into `constants.js` as single source
- [x] Remove hardcoded relays from `accountReset.js` (lines 9-15)
- [x] Remove hardcoded relays from `CampaignView.vue` (~line 1305)
- [x] Remove hardcoded relays from `useCampaigns.js` (line ~640)
- [x] Add `STORAGE_KEYS` registry to `constants.js` listing every localStorage key
- [x] Verify: `grep -r 'wss://' src/` shows relays only in `constants.js` and `nostrImports.js`

**Why second:** Every later step depends on config being in one place.

---

## Step 3: Feature Audit & Cleanup (100% DONE)

Untangle early-development wiring. One feature per commit.

### Campaigns (`useCampaigns.js`, ~900 lines)
- [x] Separate fetch logic from aggregation logic
- [x] Separate cache logic from live subscription logic *(Phase 6 extracted to openLiveZapSubscription)*
- [x] Review 6-phase zap aggregation -- simplify where possible *(helpers extracted, live sub separated, shared resolver)*

### Audience (`useAudience.js`, `useFollowLists.js`)
- [x] Separate list management from Nostr publishing *(shared publishContactList + fetchCurrentContactList helpers)*
- [x] Review kind 3 full-list replacement pattern *(deduplicated — both files use publishContactList)*
- [x] Untangle follow pack dependency *(useFollowLists imports helpers from useAudience, no more inline duplication)*

### Content (`useContent.js` + `useNostrLongForm.js` + `useContentZaps.js`)
- [x] Make data flow between the three composables explicit *(useContent owns storage, exports accessors for other composables)*
- [x] Remove indirect coupling through localStorage and event IDs *(useNostrLongForm + useContentZaps + EngagementAnalytics now go through useContent)*

### Chat (`useNostrChat.js`)
- [x] Fix fragile NIP-04 vs NIP-44 encryption detection *(encryptMessage now returns {ciphertext, nip}, logs fallback; decrypt auto-detects via ?iv= marker)*
- [x] Clear conversation key cache on logout *(conversations + messages + processedEventIds all cleared; SignerService handles crypto keys internally)*

### Calendar (`useNostrCalendar.js`)
- [x] Clean up multiple subscription variables *(2 subs cleanly separated)*
- [x] Optimize profile fetching (don't fetch on every event) *(now batched for both participants and RSVPs)*

### Engagement Metrics (`useEngagementMetrics.js`)
- [x] Fix one-subscription-per-event pattern (causes relay spam with many notes)

### All composables
- [x] Remove dead code and unused variables *(removed getMutualFollows, selectedContent/editingContent, viewContent/previewContent)*
- [x] Remove redundant logic and odd patterns from early development *(debug console.logs cleaned across composables)*

**Why third:** Can't build professional plumbing on tangled pipes.

---

## Step 3b: nostr-core Adoption -- Replace Manual Implementations (~90% DONE)

nostr-core provides tested helpers for 8 features we currently implement manually.
Each migration: add import to `nostrImports.js` -> replace manual code -> verify.

### Add missing imports to `nostrImports.js`
- [x] Add `nip52` (calendar events)
- [x] Add `nip75` (zap goals)
- [x] Add `blossom` (media uploads)
- [x] Add `bolt11` / `decodeBolt11` (invoice decoding) *(shimmed via light-bolt11-decoder until nostr-core ships native module)*
- [~] Add `nip24` (extended metadata) *(not yet needed — no consumer identified)*

### NIP-52 Calendar → `useNostrCalendar.js` (~300 lines replaced)
- [x] Replace manual tag parsing (lines 89-175) with `nip52.parseTimeBasedCalendarEvent()`
- [x] Replace manual tag building (lines 325-408) with `nip52.createTimeBasedCalendarEventTemplate()`
- [x] Replace manual RSVP parsing with `nip52.parseCalendarEventRSVP()`
- [x] Replace manual RSVP creation with `nip52.createCalendarEventRSVPTemplate()`
- [~] Use `nip52.isCalendarEvent()` for type checks *(not needed — we filter by kind directly)*
- [~] Use `nip52.buildCalendarEventAddress()` for address construction *(not needed — we build inline)*

### NIP-75 Zap Goals → `useCampaigns.js` (~50 lines replaced)
- [x] Replace manual kind 9041 event construction with `nip75.createZapGoalTemplate()`
- [x] Replace manual zap goal parsing with `nip75.parseZapGoal()`
- [ ] Use `nip75.calculateZapGoalProgress()` for campaign progress tracking
- [ ] Use `nip75.isZapGoalOpen()` for campaign status checks

### NIP-17 Private DMs → `useNostrChat.js` (~80 lines replaced)
- [ ] Replace manual 3-layer gift wrap unwrapping (lines 142-177) with `unwrapDirectMessage()`
- [ ] Replace manual kind 4 DM construction (lines 405-410) with `wrapDirectMessage()`
- [x] Remove fragile NIP-04 vs NIP-44 auto-detect *(encryptMessage now returns {ciphertext, nip}, logs fallback)*

### NIP-02 Follow Lists → `useAudience.js`, `useFollowLists.js` (~100 lines replaced)
- [x] Replace manual `tag[0] === 'p'` extraction with `nip02.getFollowedPubkeys()`
- [x] Replace manual contact list event building with `nip02.createFollowListEventTemplate()`
- [~] Use `nip02.parseFollowList()` for structured contact data *(getFollowedPubkeys sufficient for current use)*
- [~] Use `nip02.isFollowing()` for follow checks *(local reactive check preferred over event-based check)*
- [x] Deduplicate kind 3 merge logic between the two files

### NIP-10 Thread Tags → `useNostrNotes.js`, `useContent.js` (~40 lines replaced)
- [~] Replace manual reply tag building with `nip10.buildThreadTags()` *(N/A — only creates top-level notes, no replies)*
- [~] Use `nip10.parseThread()` for reply chain resolution *(N/A — no thread display)*

### NIP-27 Content References → `useMentions.js` (~60 lines replaced)
- [x] Replace regex `nostr:` URI parsing with `nip27.extractReferences()`
- [~] Replace manual mention insertion with `nip27.replaceReferences()` *(N/A — insertMention is authoring, not parsing)*

### Blossom Media → `blossomService.js` (~80 lines replaced)
- [x] Replace manual SHA-256 hashing with `blossom.getBlobHash()`
- [x] Replace manual kind 24242 auth event creation with `blossom.createAuthEventTemplate()` *(uses template + signEvent for NIP-07/NIP-46 compat)*
- [x] Replace manual auth header encoding with `blossom.getAuthorizationHeader()`
- [~] Replace manual HTTP upload with `blossom.uploadBlob()` *(kept XHR for upload progress tracking)*
- [x] Replace manual list/delete with `blossom.listBlobs()` / `blossom.deleteBlob()`
- [x] Use `blossom.mirrorBlob()` for mirror operations

### BOLT-11 Invoice Decoding → `invoiceUtils.js` (~200 lines replaced)
- [x] Replace regex-based invoice parsing with `bolt11.decode()`
- [x] Get accurate `amountSat`, `paymentHash`, `expiry`, `isExpired`, `description` from decoder
- [x] Remove manual amount extraction regex fallbacks
- [x] Remove manual payment hash extraction with deterministic hash fallback

**Why 3b:** Every manual implementation is a maintenance burden and a source of bugs. nostr-core's helpers are tested and spec-compliant. ~900 lines of manual code replaced.

---

## Step 4: Subscription Lifecycle (100% DONE)

### Navigation leaks
- [x] Close page subscriptions when user navigates away *(`:key="currentPage"` handles this)*
- [x] Verify `:key="currentPage"` in App.vue triggers proper cleanup
- [x] Add `onUnmounted` cleanup to composables that lack it

### Central registry
- [x] Create `SubscriptionRegistry` -- tracks what's open, who opened it
- [x] Integrate into `NostrService.subscribe()` and close handlers
- [x] On logout: `registry.closeAll()` as single cleanup point

### Module-scoped leaks
- [x] Audit: `useNostrChat` -- chatSubscription (module-scoped)
- [x] Audit: `useCampaigns` -- liveZapSubscription (module-scoped) *(stopCampaignZapAggregation + timer cleanup on logout)*
- [x] Audit: `useAudience` -- following/followers subscriptions (module-scoped)
- [x] Audit: `useContentZaps` -- batchedSubscription (module-scoped)
- [x] Audit: `useEngagementMetrics` -- per-event subscriptions (module-scoped)

### Manual refresh
- [x] Add refresh button to Dashboard
- [x] Add refresh button to Zap Feed
- [x] Add refresh button to Notes
- [x] Add refresh button to Audience

**Why fourth:** Leaked subscriptions waste relay connections and cause stale data.

---

## Step 5: Unified Publishing + Outbox Model (100% DONE)

### PublishService
- [x] Create `PublishService` -- sign -> verify -> publish in one call
- [x] Migrate: `useNostrNotes.js` (3 publish sites)
- [x] Migrate: `useContent.js`
- [x] Migrate: `useNostrCalendar.js`
- [x] Migrate: `useNostrChat.js`
- [x] Migrate: `useCampaigns.js`
- [x] Migrate: `useFollowLists.js`
- [x] Migrate: `useAudience.js`
- [x] Migrate: `CampaignShareModal.vue`
- [x] Migrate: `NostrProfileEditor.vue`
- [x] Migrate: `Audience.vue`

### Outbox model activation (code exists, zero callers)
- [x] On login: fetch user's kind 10002 relay list via `nostrService.fetchRelayList()`
- [x] Replace manual NIP-65 parsing in `useNostrAuth.js` with nostr-core helpers
- [x] Activate `queryOutbox()` for profile fetches (`profileFetcher.js`)
- [x] Activate `queryOutbox()` for audience queries (`useAudience.js`)
- [x] Activate `queryOutbox()` for badge queries (`useBadges.js`)
- [x] Activate `publishInbox()` for DMs (`useNostrChat.js`)
- [~] Add `relayUrls` parameter to `NostrService.subscribe()` for per-feature relay hints *(not needed -- centralized RelayPool design handles this)*
- [x] Wire campaign zap fetches to use campaign's relay tag *(Phase 1b connects to campaign relays before fetching)*

**Why together:** PublishService is the routing point. Outbox model tells it where to route.

---

## Step 6: Error Handling (100% DONE)

### Service layer
- [x] Add `PublishError`, `OutboxError`, `StorageError`, `AuthError` to `errors.js`
- [x] Extend `getUserFriendlyError()` for new error types
- [x] Replace generic `throw new Error(...)` with typed errors in NostrService
- [x] Replace generic errors in PublishService

### Composable layer (standardize pattern)
- [x] `useNostrNotes` -- catch + set user-friendly message
- [x] `useContent` -- catch + set user-friendly message
- [x] `useCampaigns` -- catch + set user-friendly message
- [x] `useNostrCalendar` -- catch + set user-friendly message
- [x] `useNostrChat` -- catch + set user-friendly message
- [x] `useAudience` -- catch + set user-friendly message
- [x] `useFollowLists` -- catch + set user-friendly message
- [x] `useBadges` -- catch + set user-friendly message
- [x] `useContentZaps` -- catch + set user-friendly message
- [x] `useEngagementMetrics` -- catch + set user-friendly message
- [x] `useMentions` -- catch + set user-friendly message

### Verify
- [x] No errors only in console -- all user-visible *(verified: all composables use getUserFriendlyError in catch blocks)*
- [x] Disconnect all relays -> user sees friendly message *(verified: RelayError NO_RELAYS → friendly message + offline banner)*
- [x] Reject signing -> user sees friendly message *(verified: AuthError SIGN_REJECTED → friendly message)*
- [x] NWC timeout -> user sees friendly message *(verified: NWCTimeoutError → friendly message)*

**Why sixth:** With solid plumbing, make failures graceful instead of silent.

---

## Step 7: Storage Layer (100% DONE)

### StorageService
- [x] Create `StorageService` with `get()`, `set()`, `remove()`, `debouncedSet()`
- [x] JSON handling with error safety
- [x] Centralized cleanup method for logout/reset

### Migrate (20 files, grouped by risk)
Group A (simple):
- [x] `useBtcPrice.js`
- [x] `usePwaInstall.js`
- [x] `useNotifications.js`
- [x] `useNostrConnections.js`

Group B (debounced writes):
- [x] `useNostrAuth.js`
- [x] `useCampaigns.js`
- [x] `useContent.js`
- [x] `useFollowLists.js`
- [x] `useAudience.js`

Group C (utilities):
- [x] `accountReset.js`
- [x] `blossomService.js`

Group D (components):
- [x] `EngagementAnalytics.vue`
- [x] `ThreadsPromo.vue`
- [x] `HelpModal.vue`
- [x] `WelcomeModal.vue`
- [x] `TopBar.vue`
- [x] `App.vue`

### Verify
- [x] Data persists across page reloads *(verified: StorageService set/get round-trips for all data types)*
- [x] Logout clears correct keys *(verified: clearAuthData removes 12 auth keys, preserves campaigns/content)*
- [x] `performCompleteReset()` clears everything *(verified: clearAll removes all keys + cancels debounced writes)*
- [x] No raw `localStorage.` calls remain (grep check — only StorageService.js has direct calls)

**Why last:** Lowest risk, fully independent.

---

## Parallel Execution

After Steps 1-3 are done, three agents can work simultaneously:

```
Step 1 (reliability) -> Step 2 (config) -> Step 3 (feature cleanup) -> Step 3b (nostr-core adoption)
  |
  |-- Agent A: Step 4 -> Step 5      (subscriptions -> publish + outbox)
  |
  |-- Agent B: Step 6                 (error handling)
  |
  +-- Agent C: Step 7                 (storage)
```

Note: Step 3b can run in parallel with Steps 4-7 since it touches different files.

---

## nostr-core API Surface (reference)

### Currently using
NWC, Relay, RelayPool, Nip07Signer, NostrConnect, finalizeEvent, verifyEvent,
nip02 (imported not called), nip04, nip05, nip09, nip10 (imported not called),
nip11, nip17 (imported not called), nip19, nip22, nip23, nip25, nip27 (imported not called),
nip44, nip46, nip50, nip51, nip56, nip57, nip58, nip59, nip65, nip98,
parseRelayList, getReadRelays, getWriteRelays, parseZapReceipt, createLongFormEventTemplate,
parseLongForm, all error types, Lightning Address helpers, fiat conversion, LNURL

### Available but not imported
`nip52` (calendar), `nip75` (zap goals), `blossom` (media), `bolt11` (invoice decode),
`nip24` (extended metadata), `nip60` (cashu wallets)

### Imported but not called (dead imports to activate)
`nip02.createFollowListEventTemplate`, `nip02.parseFollowList`, `nip02.getFollowedPubkeys`,
`nip02.isFollowing`, `nip10.parseThread`, `nip10.buildThreadTags`,
`nip17.wrapDirectMessage`, `nip17.unwrapDirectMessage`,
`nip27.extractReferences`, `nip27.replaceReferences`

---

## Key Discoveries

- **NostrService already has** `queryOutbox`, `publishInbox`, `fetchRelayList` -- fully coded, now wired for profiles + DMs
- **SignerService already migrated** to nostr-core's Nip07Signer/NostrConnect
- **Boot sequence is well-designed** -- 5-phase loading with timeouts and parallel data fetch
- **The real problems are post-boot:** relay disconnect recovery, publish retry, wallet feedback, subscription leaks, data pagination
- **PublishService + StorageService + typed errors** all created and mostly wired
- **8 manual implementations** should be replaced with nostr-core helpers (~900 lines of code)
- **5 NIP modules** not even imported yet (nip52, nip75, blossom, bolt11, nip24)
- **4 NIP modules** imported but never called (nip02 helpers, nip10, nip17, nip27)

---

## Rules for Every Step

1. **Each step leaves the app fully working** -- no half-done migrations
2. **One feature at a time** -- don't touch campaigns and audience in the same commit
3. **Test after every change** -- boot the app, login, verify the feature works
4. **No new features during revamp** -- this is purely cleanup and rewiring
5. **When in doubt, simplify** -- if old code does something weird, ask why before removing it
6. **User experience over code elegance** -- a working retry button matters more than a clean abstraction
7. **nostr-core first** -- if the library has a helper, use it. Don't roll your own.
