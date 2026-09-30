<p align="center">
  <img src="public/OG-Image/og-image.jpg" alt="ZapTracker" width="100%" />
</p>

<h1 align="center">ZapTracker</h1>

<p align="center">
  <strong>Your all-in-one Bitcoin Lightning & Nostr dashboard</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/YakiHonne-Hackathon_Winner-orange?style=for-the-badge&logo=lightning&logoColor=white" alt="Hackathon Winner"/>
  <img src="https://img.shields.io/badge/OpenSats-Grant_Supported-blue?style=for-the-badge&logo=bitcoin&logoColor=white" alt="OpenSats Grant"/>
  <img src="https://img.shields.io/badge/Vue_3-Composition_API-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License"/>
</p>

<p align="center">
  <a href="https://zaptracker.netlify.app">Live App</a> &bull;
  <a href="docs/FEATURES.md">Features</a> &bull;
  <a href="GUIDE.md">User Guide</a> &bull;
  <a href="use_cases.md">Use Cases</a> &bull;
  <a href="docs/CONTRIBUTING.md">Contributing</a>
</p>

---

ZapTracker brings everything a Nostr creator needs into one place: SocialDesk, Zap analytics, wallet management, content publishing, audience growth, and fundraising campaigns. No server, no sign-up -- your data stays in your browser.

## Features at a Glance

<table>
  <tr>
    <td align="center" width="50%">
      <img src="public/Onboarding-Pictures/dashboard.png" alt="Dashboard" width="100%"/>
      <br/><strong>Dashboard</strong><br/>
      Real-time zap metrics, activity charts, and recent supporters
    </td>
    <td align="center" width="50%">
      <img src="public/Onboarding-Pictures/analytics.png" alt="Analytics" width="100%"/>
      <br/><strong>Analytics</strong><br/>
      Deep insights into zap performance, top supporters, and trends
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="public/Onboarding-Pictures/zapfeed.png" alt="Zap Feed" width="100%"/>
      <br/><strong>Zap Feed</strong><br/>
      Live activity stream with time filters and compact view
    </td>
    <td align="center">
      <img src="public/Onboarding-Pictures/chat.png" alt="Chat" width="100%"/>
      <br/><strong>Chat + Zaps</strong><br/>
      Message your community and request payments inline
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="public/Onboarding-Pictures/longform.png" alt="Content" width="100%"/>
      <br/><strong>Content Studio</strong><br/>
      Publish long-form articles (NIP-23) and track revenue per post
    </td>
    <td align="center">
      <img src="public/Onboarding-Pictures/notes.png" alt="Notes" width="100%"/>
      <br/><strong>Notes</strong><br/>
      Short-form posts with engagement metrics and revenue tracking
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="public/Onboarding-Pictures/campaigns.png" alt="Campaigns" width="100%"/>
      <br/><strong>Campaigns</strong><br/>
      Kickstarter-style fundraising powered by Bitcoin zaps
    </td>
    <td align="center">
      <img src="public/Onboarding-Pictures/audiance.png" alt="Audience" width="100%"/>
      <br/><strong>Audience</strong><br/>
      Manage followers, discover people, and curate Follow Packs
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="public/Onboarding-Pictures/calendar.png" alt="Calendar" width="60%"/>
      <br/><strong>Calendar</strong><br/>
      Schedule and manage your zap-related events
    </td>
  </tr>
</table>

> See the full [Features Guide](docs/FEATURES.md) for wallet, media library, MiniPoS, and more.

## Quick Start

### Prerequisites

- Node.js 18+
- A Nostr identity (browser extension like [Alby](https://getalby.com) or nos2x)
- A [Nostr Wallet Connect](https://nwc.dev) enabled wallet

### Install & Run

```bash
git clone https://github.com/DoktorShift/zap_dashboard_hackathon.git
cd zap_dashboard_hackathon
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect your wallet.

### Build for Production

```bash
npm run build
npm run preview
```

## Privacy First

ZapTracker stores **zero data on any server**. Everything lives in your browser's local storage. Your keys, your data, your sovereignty.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API) |
| Build | Vite + PWA |
| Styling | TailwindCSS |
| Nostr | [nostr-core](https://www.npmjs.com/package/nostr-core) |
| Charts | ECharts via vue-echarts |
| Media | Blossom protocol |
| Calendar | FullCalendar |

## Documentation

| Document | What's inside |
|----------|--------------|
| **[Features](docs/FEATURES.md)** | Detailed walkthrough of every feature with screenshots |
| **[User Guide](GUIDE.md)** | Step-by-step setup, wallet ops, content creation, troubleshooting |
| **[Use Cases](use_cases.md)** | Real-world scenarios for creators, merchants, communities |
| **[Architecture](STRUCTURE.md)** | Codebase organization for contributors |
| **[Contributing](docs/CONTRIBUTING.md)** | How to contribute, dev guidelines, PR process |

## Support

- **Issues**: [GitHub Issues](https://github.com/DoktorShift/zap_dashboard_hackathon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DoktorShift/zap_dashboard_hackathon/discussions)
- **Docs**: [docs-zaptracker.netlify.app](https://docs-zaptracker.netlify.app)

---

<p align="center">
  Made with <img src="https://img.shields.io/badge/-%E2%9A%A1-orange?style=flat-square" alt="zap" height="14"/> by
  <a href="https://github.com/pratik227">Pratik</a> &
  <a href="https://github.com/DoktorShift">DoktorShift</a>
  &bull; Licensed under <a href="LICENSE">MIT</a>
</p>
