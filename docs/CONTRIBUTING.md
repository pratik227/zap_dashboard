# Contributing to ZapTracker

Thanks for your interest in contributing! ZapTracker is an open-source Nostr dashboard backed by an OpenSats grant. Every contribution — bug fix, feature, docs, tests — moves the needle for creators on the Bitcoin/Nostr stack.

> **First time?** Read the [Architecture Guide](../STRUCTURE.md) to understand the codebase layout.

---

## Why Your Contribution Matters

ZapTracker has no server and no sign-up. That means reliability and UX quality are entirely in the codebase. A contribution that fixes a relay reconnect bug or adds a missing retry button directly impacts every creator using the tool. The code you ship is the product.

The project just completed a major revamp (outbox model activation, unified publishing, typed errors, storage abstraction, subscription lifecycle fixes). The foundation is now solid — and there's a clear backlog of improvements ready for new contributors to pick up.

---

## Good First Issues

We maintain open issues specifically designed to make onboarding smooth. Look for:

- **`good first issue`** — self-contained, well-scoped, no deep context needed
- **`help wanted`** — higher impact, documented context in the issue

Browse them at: [GitHub Issues](https://github.com/DoktorShift/zap_dashboard_hackathon/issues)

These issues typically cover:
- UI polish and empty states
- Missing test coverage
- NIP feature completions (e.g. NIP-17 gift wrap, NIP-75 progress helpers)
- Accessibility improvements
- Documentation gaps

---

## Getting Started

1. **Fork** the repository
2. **Clone** your fork
   ```bash
   git clone https://github.com/<your-username>/zap_dashboard_hackathon.git
   cd zap_dashboard_hackathon
   ```
3. **Install** dependencies
   ```bash
   npm install
   ```
4. **Create** a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Start** the dev server
   ```bash
   npm run dev
   ```

You'll need a Nostr browser extension (Alby or nos2x) to log in during development.

---

## Development Guidelines

### Stack conventions
- **Vue 3 Composition API** — use `<script setup>` syntax
- **TailwindCSS** for styling — avoid custom CSS where Tailwind utilities suffice
- **nostr-core** for all Nostr protocol interactions — do not use legacy `nostr-tools`
- **Feature-based organization** — place components, composables, and utils alongside related features (see [STRUCTURE.md](../STRUCTURE.md))

### Architecture rules
- **PublishService** for all event signing and publishing — never call `nostrService.publish()` directly from a composable
- **StorageService** for all localStorage reads/writes — never call `localStorage.*` directly
- **Typed errors** — use the error classes from `services/nostr/errors.js` and surface them via `getUserFriendlyError()`
- **Subscription cleanup** — every composable that opens a subscription must close it in `onUnmounted` or `cleanup()`
- **nostr-core first** — if the library has a helper for what you're building, use it

### What makes a PR stand out
- Fixes a real user-facing problem, not just a code smell
- Leaves the app fully working — no half-done migrations
- One feature or fix per PR — keeps review fast
- Includes a brief description of the user impact, not just the code change

---

## Commit Messages

Write concise messages that explain *why* the change was made:

```
Add relay reconnect indicator to TopBar

Users had no way to know when a relay silently dropped.
The indicator shows live connection health and updates on reconnect.
```

---

## Pull Requests

1. Keep PRs focused — one feature or fix per PR
2. Include a short description of what changed and the user impact
3. Add screenshots for UI changes
4. Make sure the build passes: `npm run build`

---

## Reporting Issues

Use [GitHub Issues](https://github.com/DoktorShift/zap_dashboard_hackathon/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info
- Screenshots if applicable

---

## Code of Conduct

Be respectful, constructive, and collaborative. We're all here to build something great for the Bitcoin & Nostr community.

---

<p align="center">
  <a href="../README.md">Back to Home</a> &bull;
  <a href="../STRUCTURE.md">Architecture</a>
</p>
