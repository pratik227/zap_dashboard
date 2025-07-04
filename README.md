# ⚡ Zap Tracker - All-in-One Dashboard

Zap Tracker is a comprehensive Bitcoin Lightning Network dashboard that provides complete visibility and management of your Zap ecosystem. Monitor analytics, manage wallets, engage with supporters, and share content - all from one powerful interface.

### Project Overview
Zap Tracker revolutionizes how creators and users interact with Bitcoin Lightning Network payments by providing a unified dashboard experience. In today's fragmented ecosystem, managing Zap payments, analytics, and community engagement requires juggling multiple platforms and tools. Zap Tracker eliminates this complexity by bringing everything together in one comprehensive interface.
The platform serves as a central hub for Lightning Network payment management, offering real-time visibility into your Zap ecosystem. Users can monitor their complete payment history, track supporter engagement, and analyze performance metrics through intuitive visualizations. The dashboard provides immediate insights into total Zaps received, sats earned, unique supporters, and average Zap amounts, enabling data-driven decision making for content creators and businesses alike.
Beyond basic analytics, Zap Tracker transforms how users engage with their communities. The integrated chat functionality allows direct communication with supporters while seamlessly incorporating Zap payments into conversations. This creates a more engaging and interactive experience that strengthens relationships between creators and their audience. The platform also includes robust content management capabilities, allowing users to post updates, announcements, and monetized content directly through the dashboard.
The wallet management system provides comprehensive control over Lightning Network finances. Users can view real-time balances, track transaction history, and send payments directly from the platform. This eliminates the need to switch between different wallet applications and provides a streamlined financial management experience.
Zap Tracker addresses the growing need for professional-grade Lightning Network tools by combining payment processing, analytics, community engagement, and content management in a single, user-friendly platform. Whether you're a content creator looking to monetize your work, a business accepting Lightning payments, or an enthusiast wanting better visibility into your Bitcoin transactions, Zap Tracker provides the comprehensive solution you need to succeed in the Lightning Network ecosystem.

### Getting Started
Ready to take control of your Zap ecosystem? Zap Tracker provides everything you need to monitor, manage, and maximize your Lightning Network payment experience.

A modern, real-time dashboard for managing and analyzing Lightning Network zaps (tips) with Nostr Wallet Connect integration.

![Zap Dashboard Preview](public/dashboard.png)

> **🔒 Privacy First**: We don't store any of your data on our servers. All data is stored locally in your browser's local storage, ensuring your privacy and data sovereignty.

## Features

### **Real-time Analytics**
- Live zap tracking and statistics
- Interactive charts and visualizations
- Performance metrics and insights
- Daily, weekly, and monthly activity views

### **Wallet Management**
- Nostr Wallet Connect (NWC) integration
- Real-time balance monitoring
- Send and receive Lightning payments
- QR code generation and scanning
- Transaction history

### **Chat + Zaps**
- Interactive chat with zap integration
- Real-time messaging with Lightning payments
- Zap notifications within conversations
- Seamless payment experience during chats

### **Zap Feed**
- Real-time zap notifications
- Advanced filtering and search
- Content performance tracking
- Supporter analytics

### **Content Management**
- Create and manage content posts
- Track content performance and engagement
- Content monetization with zaps
- Content analytics and insights

### **Point of Sale (PoS)**
- Coming soon: Mini PoS system for merchants

[//]: # (### 📈 **Content Analytics**)

[//]: # (- Content performance metrics)

[//]: # (- Revenue analytics per content)

[//]: # (- Engagement tracking)

[//]: # (- Creator insights dashboard)

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Nostr Wallet Connect enabled wallet (e.g., Alby)

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

## 🔌 Wallet Connection

### Setting up Nostr Wallet Connect

1. **Get your NWC URL**
   - Open your Alby wallet
   - Go to Settings → Connect Apps
   - Copy your Nostr Wallet Connect URL

2. **Connect in the dashboard**
   - Click "Connect Wallet" in the dashboard
   - Paste your NWC URL
   - Click "Connect"

![Wallet Connection](/public/wallet.png)

## 📱 Dashboard Overview

### Main Dashboard
![Dashboard Overview](/public/dashboard.png)

The main dashboard provides:
- **Total Zaps**: Real-time count of received zaps
- **Total Sats**: Cumulative zap amount in satoshis
- **Average Zap**: Mean zap amount
- **Unique Supporters**: Number of unique zap senders
- **Wallet Balance**: Current Lightning wallet balance
- **Activity Chart**: 30-day zap activity visualization

### Zap Feed
![Zap Feed](/public/zaps.png)

Features:
- Real-time zap notifications
- Advanced filtering by amount, sender, and content type
- Search functionality
- Compact and detailed view modes

### Chat + Zaps
![Chat + Zaps Interface](/public/chat_zap.png)

Interactive chat with zap integration:
- Real-time messaging with Lightning payments
- Zap notifications within conversations
- Seamless payment experience during chats
- Connection management for chat participants

### Content Management
![Content Management](/public/image.png)

Comprehensive content management system:
- Create and manage content posts
- Track content performance and engagement
- Content monetization with zaps
- Revenue analytics per content piece

### Analytics
![Analytics Dashboard](/public/analytics.png)

Comprehensive analytics including:
- Daily zap activity trends
- Top supporters analysis
- Revenue performance metrics
- Content engagement insights

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

[//]: # (- **QR Code** - Payment scanning and generation)

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
