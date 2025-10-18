<h1 align="center">⚡ Zap Tracker - All-in-One Dashboard</h1>

<p align="center">
  <img src="https://img.shields.io/badge/YakiHonne-Hackathon_Winner-orange?style=for-the-badge&logo=lightning&logoColor=white" alt="Hackathon Winner"/>
  <img src="https://img.shields.io/badge/OpenSats-Grant_Supported-blue?style=for-the-badge&logo=bitcoin&logoColor=white" alt="OpenSats Grant"/>
</p> 

<p align="center">
  <img alt="Vue.js Icon" src="https://img.shields.io/badge/-Vue.js-42b883?style=flat-square&logo=vuedotjs&logoColor=white" />
  <img alt="Vite Icon" src="https://img.shields.io/badge/-Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img alt="Tailwind CSS Icon" src="https://img.shields.io/badge/-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img alt="Iconify Icon" src="https://img.shields.io/badge/-Iconify-1769aa?style=flat-square&logo=iconify&logoColor=white" />
</p>

### Project Overview
Zap Tracker revolutionizes how creators and users interact with Bitcoin Lightning & Nostr by providing a unified dashboard experience. In today's fragmented ecosystem, managing Zap payments, analytics, and community engagement requires juggling multiple platforms and tools. Zap Tracker eliminates this complexity by bringing everything together in one comprehensive interface.

The platform serves as a central hub for Lightning Network payment management, offering real-time visibility into your Zap ecosystem. Users can monitor their complete payment history, track supporter engagement, and analyze performance metrics through intuitive visualizations.

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

![Wallet-NWC](https://github.com/user-attachments/assets/02f5c67e-6e5d-4c29-bcff-7aff2e60ef5f)

### Content Management
- Create and manage content posts
- Track content performance and engagement
- Content monetization with zaps
- Content analytics and insights

![Content Management](https://storage.googleapis.com/geyser-images-distribution-prod-us/bdc7adfe-fd7c-43d4-a348-30ffd5f3ad99_new_content_ui_2/image_large.webp)

[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4860?hero=drshift)


### Analytics
- Live zap tracking and statistics
- Interactive charts and visualizations
- Performance metrics and insights
- Daily, weekly, and monthly activity views

![Analytics Dashboard](https://storage.googleapis.com/geyser-images-distribution-prod-us/5508d59f-4a20-466f-87a4-5a6c38063a5f_Analytics_new/image_large.webp)


### Audience
- Build your community with [Follow Packs](https://github.com/callebtc/following.space)
- Engage & grow your supporter base

![Audience](https://storage.googleapis.com/geyser-images-distribution-prod-us/cd595b5c-2807-46f4-91f7-f8e722cea04f_Audience_2/image_large.webp)
[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4926?hero=drshift)

### ZapGoals
- Set funding goals like Kickstarter - but with Bitcoin zaps
- Track progress, motivate supporters, unlock milestones

![ZapGoals](https://storage.googleapis.com/geyser-images-distribution-prod-us/2069d1d6-edfb-4b78-b291-4de2b849c86a_sneak_peek_campaigns_4/image_large.webp)

[See Blog Post on Geyser](https://geyser.fund/project/zaptracker/posts/view/4831?hero=drshift)

[//]: # (## Technology Stack)

[//]: # ()
[//]: # (### Frontend)

[//]: # (- **Vue 3** - Progressive JavaScript framework)

[//]: # (- **Vite** - Fast build tool and dev server)

[//]: # (- **Tailwind CSS** - Utility-first CSS framework)

[//]: # (- **ECharts** - Interactive charting library)

[//]: # (- **Lucide Vue** - Beautiful icon library)

[//]: # ()
[//]: # (### Lightning Network)

[//]: # (- **Nostr Wallet Connect** - Wallet connection protocol)

[//]: # (- **Alby SDK** - Lightning wallet integration)

[//]: # (- **QR Code** - BOLT11 Payment scanning and generation)

[//]: # ()
[//]: # (### Development Tools)

[//]: # (- **PostCSS** - CSS processing)

[//]: # (- **Autoprefixer** - CSS vendor prefixing)

[//]: # ()
[//]: # (## Project Structure)

[//]: # ()
[//]: # (```)

[//]: # (zap_dashboard/)

[//]: # (├── src/)

[//]: # (│   ├── components/          # Reusable Vue components)

[//]: # (│   │   ├── Analytics.vue    # Analytics charts and metrics)

[//]: # (│   │   ├── Filters.vue      # Search and filter components)

[//]: # (│   │   ├── NWCConnection.vue # Wallet connection interface)

[//]: # (│   │   ├── Sidebar.vue      # Navigation sidebar)

[//]: # (│   │   ├── TopBar.vue       # Top navigation bar)

[//]: # (│   │   └── ...)

[//]: # (│   ├── pages/               # Main application pages)

[//]: # (│   │   ├── Dashboard.vue    # Main dashboard view)

[//]: # (│   │   ├── ZapFeed.vue      # Zap feed and notifications)

[//]: # (│   │   ├── Analytics.vue    # Detailed analytics)

[//]: # (│   │   ├── Wallet.vue       # Wallet management)

[//]: # (│   │   ├── MiniPoS.vue      # Point of sale system)

[//]: # (│   │   └── ...)

[//]: # (│   ├── composables/         # Vue 3 composables)

[//]: # (│   │   ├── useContent.js    # Content management logic)

[//]: # (│   │   ├── useNostrConnections.js # Wallet connection logic)

[//]: # (│   │   └── useNotifications.js # Notification system)

[//]: # (│   ├── utils/               # Utility functions)

[//]: # (│   │   ├── nwcClient.js     # Nostr Wallet Connect client)

[//]: # (│   │   ├── dataMapper.js    # Data transformation utilities)

[//]: # (│   │   └── mockData.js      # Sample data for development)

[//]: # (│   └── assets/              # Static assets)

[//]: # (│       ├── LOGO.svg         # Application logo)

[//]: # (│       ├── nwc-logo.svg     # NWC logo)

[//]: # (│       └── ...)

[//]: # (├── public/                  # Public static files)

[//]: # (├── package.json             # Dependencies and scripts)

[//]: # (├── vite.config.js          # Vite configuration)

[//]: # (├── tailwind.config.js      # Tailwind CSS configuration)

[//]: # (└── README.md               # This file)

[//]: # (```)

[//]: # (## Configuration)

[//]: # ()
[//]: # (### Environment Variables)

[//]: # ()
[//]: # (Create a `.env` file in the root directory:)

[//]: # ()
[//]: # (```env)

[//]: # (# Development settings)

[//]: # (VITE_APP_TITLE=Zap Dashboard)

[//]: # (VITE_APP_VERSION=1.0.0)

[//]: # ()
[//]: # (# Lightning Network settings &#40;if needed&#41;)

[//]: # (VITE_LIGHTNING_NETWORK=mainnet)

[//]: # (```)

[//]: # ()
[//]: # (### Tailwind Configuration)

[//]: # ()
[//]: # (The project uses a custom Tailwind configuration with:)

[//]: # (- Orange color scheme for Lightning Network branding)

[//]: # (- Custom animations and transitions)

[//]: # (- Responsive design utilities)

[//]: # (## Customization)

[//]: # ()
[//]: # (### Styling)

[//]: # (The application uses Tailwind CSS with a custom orange theme. You can customize colors in `tailwind.config.js`:)

[//]: # ()
[//]: # (```javascript)

[//]: # (module.exports = {)

[//]: # (  theme: {)

[//]: # (    extend: {)

[//]: # (      colors: {)

[//]: # (        orange: {)

[//]: # (          25: '#fff7ed',)

[//]: # (          50: '#ffedd5',)

[//]: # (          // ... other shades)

[//]: # (        })

[//]: # (      })

[//]: # (    })

[//]: # (  })

[//]: # (})

[//]: # (```)

[//]: # ()
[//]: # (### Components)

[//]: # (All components are modular and can be easily customized. Each component follows Vue 3 Composition API patterns.)

[//]: # (## Deployment)

[//]: # ()
[//]: # (### Vercel)

[//]: # (1. Connect your repository to Vercel)

[//]: # (2. Set build command: `npm run build`)

[//]: # (3. Set output directory: `dist`)

[//]: # (4. Deploy)

[//]: # ()
[//]: # (### Netlify)

[//]: # (1. Connect your repository to Netlify)

[//]: # (2. Set build command: `npm run build`)

[//]: # (3. Set publish directory: `dist`)

[//]: # (4. Deploy)

[//]: # ()
[//]: # (### Docker)

[//]: # (```dockerfile)

[//]: # (FROM node:18-alpine)

[//]: # (WORKDIR /app)

[//]: # (COPY package*.json ./)

[//]: # (RUN npm ci --only=production)

[//]: # (COPY . .)

[//]: # (RUN npm run build)

[//]: # (EXPOSE 3000)

[//]: # (CMD ["npm", "run", "preview"])

[//]: # (```)

## 🤝 Contributing

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

## 🙏 Acknowledgments

- **Nostr Wallet Connect** - For the wallet connection protocol
- **Alby** - For the Lightning wallet integration
- **Vue.js** - For the amazing frontend framework
- **Tailwind CSS** - For the utility-first CSS framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/pratik227/zap_dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pratik227/zap_dashboard/discussions)

---

**Made with ⚡ by the [Pratik](https://github.com/pratik227) and [DoktorShift](https://github.com/DoktorShift)**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
