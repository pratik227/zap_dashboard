import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'
import bridgeProxy from './netlify/functions/bridge-proxy.mjs'

// Serve the Netlify bridge-proxy function during `vite dev`
const bridgeProxyDev = () => ({
    name: 'bridge-proxy-dev',
    configureServer(server) {
        server.middlewares.use('/.netlify/functions/bridge-proxy', async (req, res) => {
            const response = await bridgeProxy(new Request(`http://localhost${req.originalUrl}`, {method: req.method}))
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(Buffer.from(await response.arrayBuffer()))
        })
    }
})

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.js'],
        globals: true,
    },
    plugins: [
        vue(),
        bridgeProxyDev(),
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
    build: {
        rolldownOptions: {
            output: {
                // Strip console/debugger from production bundles (dev keeps its logs)
                minify: {
                    compress: {
                        dropConsole: true,
                        dropDebugger: true
                    }
                },
                // Vendor chunks, including each library's own dependencies
                codeSplitting: {
                    groups: [
                        {name: 'echarts', test: /node_modules[\\/](echarts|zrender|vue-echarts)[\\/]/},
                        {name: 'nostr-core', test: /node_modules[\\/](nostr-core|@noble|@scure)[\\/]/},
                        {name: 'dicebear', test: /node_modules[\\/]@dicebear[\\/]/},
                        {name: 'fullcalendar', test: /node_modules[\\/](@fullcalendar|preact)[\\/]/}
                    ]
                }
            }
        },
        chunkSizeWarningLimit: 1000
    }
})
