import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.js'],
        globals: true,
    },
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'robots.txt'],
            workbox: {
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
                skipWaiting: true,
                clientsClaim: true
            },
            manifest: {
                name: 'Zap Dashboard',
                short_name: 'ZapDash',
                description: 'Lightning-powered dashboard for Nostr and more!',
                theme_color: '#fb933c',
                id: '/',
                dir: 'ltr',
                categories: ['productivity', 'finance', 'utilities'],
                iarc_rating_id: '',
                prefer_related_applications: false,
                related_applications: [],
                scope_extensions: [],
                orientation: 'portrait',
                launch_handler: {
                    client_mode: 'auto'
                },
                icons: [
                    {
                        src: 'new_logo3.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'new_logo3.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ],
                screenshots: [
                    {
                        src: 'Onboarding-Pictures/dashboard.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Main dashboard view'
                    },
                    {
                        src: 'Onboarding-Pictures/analytics.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Analytics dashboard'
                    },
                    {
                        src: 'Onboarding-Pictures/campaigns.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Campaigns overview'
                    },
                    {
                        src: 'Onboarding-Pictures/zapfeed.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Zap feed view'
                    },
                    {
                        src: 'Onboarding-Pictures/chat.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        label: 'Chat messaging'
                    }
                ]
            }
        })
    ],
    esbuild: {
        drop: ['console', 'debugger']
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'echarts': ['echarts', 'vue-echarts'],
                    'nostr-core': ['nostr-core'],
                    'dicebear': ['@dicebear/core', '@dicebear/collection'],
                    'fullcalendar': ['@fullcalendar/core', '@fullcalendar/vue3', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/interaction', '@fullcalendar/list']
                }
            }
        },
        chunkSizeWarningLimit: 1000
    }
})
