// vite.config.js
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import vue from "file:///home/project/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { VitePWA } from "file:///home/project/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Zap Dashboard",
        short_name: "ZapDash",
        description: "Lightning-powered dashboard for Nostr and more!",
        theme_color: "#42b883",
        id: "/",
        dir: "ltr",
        categories: ["productivity", "finance", "utilities"],
        iarc_rating_id: "",
        prefer_related_applications: false,
        related_applications: [],
        scope_extensions: [],
        orientation: "portrait",
        launch_handler: {
          client_mode: "auto"
        },
        icons: [
          {
            src: "dashboard.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "dashboard.png",
            sizes: "512x512",
            type: "image/png"
          }
        ],
        screenshots: [
          {
            src: "dashboard.png",
            sizes: "1280x720",
            type: "image/png",
            label: "Main dashboard view"
          },
          {
            src: "wallet.png",
            sizes: "1280x720",
            type: "image/png",
            label: "Wallet overview"
          },
          {
            src: "analytics.png",
            sizes: "1280x720",
            type: "image/png",
            label: "Analytics dashboard"
          },
          {
            src: "zap_feed.png",
            sizes: "1280x720",
            type: "image/png",
            label: "Zap feed view"
          }
        ]
      }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcuanNcIjtpbXBvcnQge2RlZmluZUNvbmZpZ30gZnJvbSAndml0ZSdcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuaW1wb3J0IHtWaXRlUFdBfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAgIHBsdWdpbnM6IFtcbiAgICAgICAgdnVlKCksXG4gICAgICAgIFZpdGVQV0Eoe1xuICAgICAgICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICAgICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uc3ZnJywgJ3JvYm90cy50eHQnXSxcbiAgICAgICAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ1phcCBEYXNoYm9hcmQnLFxuICAgICAgICAgICAgICAgIHNob3J0X25hbWU6ICdaYXBEYXNoJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0xpZ2h0bmluZy1wb3dlcmVkIGRhc2hib2FyZCBmb3IgTm9zdHIgYW5kIG1vcmUhJyxcbiAgICAgICAgICAgICAgICB0aGVtZV9jb2xvcjogJyM0MmI4ODMnLFxuICAgICAgICAgICAgICAgIGlkOiAnLycsXG4gICAgICAgICAgICAgICAgZGlyOiAnbHRyJyxcbiAgICAgICAgICAgICAgICBjYXRlZ29yaWVzOiBbJ3Byb2R1Y3Rpdml0eScsICdmaW5hbmNlJywgJ3V0aWxpdGllcyddLFxuICAgICAgICAgICAgICAgIGlhcmNfcmF0aW5nX2lkOiAnJyxcbiAgICAgICAgICAgICAgICBwcmVmZXJfcmVsYXRlZF9hcHBsaWNhdGlvbnM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJlbGF0ZWRfYXBwbGljYXRpb25zOiBbXSxcbiAgICAgICAgICAgICAgICBzY29wZV9leHRlbnNpb25zOiBbXSxcbiAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcbiAgICAgICAgICAgICAgICBsYXVuY2hfaGFuZGxlcjoge1xuICAgICAgICAgICAgICAgICAgICBjbGllbnRfbW9kZTogJ2F1dG8nXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpY29uczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmM6ICdkYXNoYm9hcmQucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmM6ICdkYXNoYm9hcmQucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBzY3JlZW5zaG90czogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmM6ICdkYXNoYm9hcmQucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnMTI4MHg3MjAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ01haW4gZGFzaGJvYXJkIHZpZXcnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogJ3dhbGxldC5wbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZXM6ICcxMjgweDcyMCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnV2FsbGV0IG92ZXJ2aWV3J1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmM6ICdhbmFseXRpY3MucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnMTI4MHg3MjAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ0FuYWx5dGljcyBkYXNoYm9hcmQnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogJ3phcF9mZWVkLnBuZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplczogJzEyODB4NzIwJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdaYXAgZmVlZCB2aWV3J1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIF0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFRLG9CQUFtQjtBQUNwUCxPQUFPLFNBQVM7QUFDaEIsU0FBUSxlQUFjO0FBR3RCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLElBQUk7QUFBQSxJQUNKLFFBQVE7QUFBQSxNQUNKLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLFlBQVk7QUFBQSxNQUMzQyxVQUFVO0FBQUEsUUFDTixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixLQUFLO0FBQUEsUUFDTCxZQUFZLENBQUMsZ0JBQWdCLFdBQVcsV0FBVztBQUFBLFFBQ25ELGdCQUFnQjtBQUFBLFFBQ2hCLDZCQUE2QjtBQUFBLFFBQzdCLHNCQUFzQixDQUFDO0FBQUEsUUFDdkIsa0JBQWtCLENBQUM7QUFBQSxRQUNuQixhQUFhO0FBQUEsUUFDYixnQkFBZ0I7QUFBQSxVQUNaLGFBQWE7QUFBQSxRQUNqQjtBQUFBLFFBQ0EsT0FBTztBQUFBLFVBQ0g7QUFBQSxZQUNJLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNWO0FBQUEsVUFDQTtBQUFBLFlBQ0ksS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1Y7QUFBQSxRQUNKO0FBQUEsUUFDQSxhQUFhO0FBQUEsVUFDVDtBQUFBLFlBQ0ksS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sT0FBTztBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUEsWUFDSSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixPQUFPO0FBQUEsVUFDWDtBQUFBLFVBQ0E7QUFBQSxZQUNJLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLE9BQU87QUFBQSxVQUNYO0FBQUEsVUFDQTtBQUFBLFlBQ0ksS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sT0FBTztBQUFBLFVBQ1g7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0w7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
