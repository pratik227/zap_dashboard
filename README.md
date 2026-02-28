<h1 align="center">⚡ Zap Tracker - All-in-One Dashboard</h1>

<p align="center">
  <img src="https://img.shields.io/badge/YakiHonne-Hackathon_Winner-orange?style=for-the-badge&logo=lightning&logoColor=white" alt="Hackathon Winner"/>
  <img src="https://img.shields.io/badge/OpenSats-Grant_Supported-blue?style=for-the-badge&logo=bitcoin&logoColor=white" alt="OpenSats Grant"/>
</p> 




### Project Overview
Zap Tracker revolutionizes how creators and users interact with Bitcoin Lightning & Nostr by providing a unified dashboard experience. In today's fragmented ecosystem, managing Zap payments, analytics, and community engagement requires juggling multiple platforms and tools. Zap Tracker eliminates this complexity by bringing everything together in one comprehensive interface.

The platform serves as a central hub for Lightning Network payment management, offering real-time visibility into your Zap ecosystem. Users can monitor their complete payment history, track supporter engagement, and analyze performance metrics through intuitive visualizations.

### Documentation

| Document | Description |
|----------|-------------|
| [GUIDE.md](GUIDE.md) | Comprehensive user guide with step-by-step instructions |
| [use_cases.md](use_cases.md) | Real-world scenarios for creators, merchants, communities |
| [STRUCTURE.md](STRUCTURE.md) | Technical codebase organization for contributors |
| [nip07.md](nip07.md) | NIP-07 browser extension specification |
| [Docs](https://docs-zaptracker.netlify.app) | Documentation for ZapTracker |

### Getting Started
A modern, real-time dashboard for managing and analyzing Lightning Network zaps (tips) with Nostr Wallet Connect integration.

![ÅDashboard](https://storage.googleapis.com/geyser-images-distribution-prod-us/1d9cc125-120f-4c5c-b103-694fc61721ee_Dashboard_new/image_large.webp)

> **🔒 Privacy First**: We don't store any of your data on our servers. All data is stored locally in your browser's local storage, ensuring your privacy and data sovereignty.

[//]: # (### 📈 **Content Analytics**)

[//]: # (- Content performance metrics)

[//]: # (- Revenue analytics per content)

[//]: # (- Engagement tracking)

[//]: # (- Creator insights dashboard)

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Nostr Wallet Connect enabled wallet (e.g., Alby, Buho, Coinos, LNBits)
- A Nostr Identity

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zap_dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## 🔌 Setup ZapTracker

> **Need detailed instructions?** See the [complete setup guide](GUIDE.md#first-steps) for troubleshooting and tips.

### Get your NWC URL
- Open your NWC Provider
- Go to Settings → Connect Apps
- Copy your Nostr Wallet Connect URL

![Connect_NWC](https://storage.googleapis.com/geyser-images-distribution-prod-us/7effb1e8-904b-4d1d-9234-4c13c646fce5_nwc-connect-preview/image_large.webp)

### Connect Nostr
- Click "Settings"
- Click "Connect Nostr"
- Choose your Nostr Account 

![Connect_Nostr](https://storage.googleapis.com/geyser-images-distribution-prod-us/75fb28c3-c1b4-4601-bb3e-d260ef368def_nostr-login_new/image_large.webp)

### Main Dashboard
- **Total Zaps**: Real-time count of received zaps
- **Total Sats**: Cumulative zap amount in satoshis
- **Average Zap**: Mean zap amount
- **Unique Supporters**: Number of unique zap senders
- **Wallet Balance**: Current Lightning wallet balance
- **Activity Chart**: 30-day zap activity visualization

![Dashboard Overview](https://storage.googleapis.com/geyser-images-distribution-prod-us/1d9cc125-120f-4c5c-b103-694fc61721ee_Dashboard_new/image_large.webp)

### Zap Feed
- Real-time zap notifications
- Content performance tracking
- Supporter analytics

![Zap Feed](https://github.com/user-attachments/assets/2d4001fd-f9ea-4a7a-ba7a-7abf42ecbfaa)


### Chat
- Interactive chat
- Community connection

![Chat Interface](https://github.com/user-attachments/assets/21352e1d-3a1d-4160-96d2-88f7a467b4fe)

### Wallet
- Nostr Wallet Connect (NWC) integration
- Real-time balance monitoring
- Send and receive Lightning payments
- QR code generation and scanning
- Transaction history

> Learn more about [wallet operations](GUIDE.md#wallet-operations) or see [merchant use cases](use_cases.md#merchants--freelancers).

![Wallet-NWC](https://github.com/user-attachments/assets/02f5c67e-6e5d-4c29-bcff-7aff2e60ef5f)

### Content Management
- Create and manage content posts
- Track content performance and engagement
- Content monetization with zaps
- Content analytics and insights

> See [use cases for content creators](use_cases.md#content-creators) for monetization strategies.

![Content Management](https://storage.googleapis.com/geyser-images-distribution-prod-us/bdc7adfe-fd7c-43d4-a348-30ffd5f3ad99_new_content_ui_2/image_large.webp)

[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4860?hero=drshift)


### Analytics
- Live zap tracking and statistics
- Interactive charts and visualizations
- Performance metrics and insights
- Daily, weekly, and monthly activity views

> Dive deeper into [analytics interpretation](GUIDE.md#analytics-deep-dive) for actionable insights.

![Analytics Dashboard](https://storage.googleapis.com/geyser-images-distribution-prod-us/5508d59f-4a20-466f-87a4-5a6c38063a5f_Analytics_new/image_large.webp)


### Audience
- Build your community with [Follow Packs](https://github.com/callebtc/following.space)
- Engage & grow your supporter base

> Learn how to [build and curate Follow Lists](GUIDE.md#growing-your-audience) or see [community builder use cases](use_cases.md#community-builders).

![Audience](https://storage.googleapis.com/geyser-images-distribution-prod-us/cd595b5c-2807-46f4-91f7-f8e722cea04f_Audience_2/image_large.webp)
[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4926?hero=drshift)

### ZapGoals
- Set funding goals like Kickstarter - but with Bitcoin zaps
- Track progress, motivate supporters, unlock milestones

> See how to [run successful campaigns](GUIDE.md#running-campaigns) or explore [event organizer](use_cases.md#event-organizers) and [open source funding](use_cases.md#open-source-developers) use cases.

![ZapGoals](https://storage.googleapis.com/geyser-images-distribution-prod-us/2069d1d6-edfb-4b78-b291-4de2b849c86a_sneak_peek_campaigns_4/image_large.webp)

[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4831?hero=drshift)

## 🤝 Contributing

> **First time contributing?** Check out [STRUCTURE.md](STRUCTURE.md) to understand the codebase organization.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

[//]: # (### Development Guidelines)

[//]: # (- Use Vue 3 Composition API)

[//]: # (- Follow Tailwind CSS conventions)

[//]: # (- Write meaningful commit messages)

[//]: # (- Test thoroughly before submitting PRs)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/pratik227/zap_dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pratik227/zap_dashboard/discussions)

---

**Made with ⚡ by the [Pratik](https://github.com/pratik227) and [DoktorShift](https://github.com/DoktorShift)**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
