# Project Structure

This document describes the organization of the ZapTracker codebase to help contributors quickly find and understand where different parts of the application live.

> **Looking for user documentation?** See [GUIDE.md](GUIDE.md) for usage instructions or [use_cases.md](use_cases.md) for real-world scenarios.

## Overview

The project follows a feature-based organization pattern where related files are grouped together by domain/feature area rather than by file type. This makes it easier to find related code and understand feature boundaries.

## Directory Structure

```
src/
├── components/          # Vue components organized by feature
│   ├── analytics/       # Analytics and metrics components
│   ├── audience/        # Audience management and follow lists
│   ├── badges/          # Badge display and management
│   ├── campaigns/       # Campaign/fundraising components
│   ├── content/         # Content creation and management
│   ├── media/           # Media library (Blossom upload, grid/list views)
│   ├── layout/          # Layout components (Sidebar, TopBar)
│   ├── modals/          # Modal dialogs
│   ├── profile/         # Profile-related components
│   ├── settings/        # Settings and configuration
│   ├── shared/          # Shared/common components
│   ├── wallet/          # Wallet and NWC components
│   └── zaps/            # Zap feed and Lightning Network
│
├── composables/         # Vue composables organized by domain
│   ├── analytics/       # Analytics composables
│   ├── audience/        # Audience and follow list composables
│   ├── auth/            # Authentication composables
│   ├── campaigns/       # Campaign management composables
│   ├── content/         # Content creation and publishing
│   ├── media/           # Media state and Blossom server composables
│   ├── core/            # Core app composables (BTC price, connections, notifications)
│   ├── social/          # Social features (badges, chat)
│   └── wallet/          # Lightning wallet composables
│
├── pages/               # Top-level page components (routes)
│
├── services/            # Business logic services
│
├── utils/               # Utility functions organized by domain
│   ├── account/         # Account management utilities
│   ├── content/         # Content processing utilities
│   ├── core/            # Core utilities (date, time, data mapping)
│   ├── network/         # Network and relay management
│   ├── profile/         # Profile utilities (avatar, fetching)
│   └── wallet/          # Wallet and payment utilities
│
└── assets/              # Static assets (images, SVGs)
```

## Feature Areas

### Analytics (`analytics/`)
Components and composables for tracking zaps, earnings, and engagement metrics.

**Components:**
- `Analytics.vue` - Main analytics dashboard
- `EmptyStateAnalytics.vue` - Empty state for analytics
- `EngagementAnalytics.vue` - Engagement metrics display
- `EngagementMetrics.vue` - Detailed engagement metrics
- `StatsCards.vue` - Stats card components

**Composables:**
- `useEngagementMetrics.js` - Engagement metrics logic

### Audience (`audience/`)
Components and composables for managing your audience, followers, and follow lists.

**Components:**
- `AudienceOverview.vue` - Audience analytics overview
- `FollowListCard.vue` - Follow list card display
- `FollowListManager.vue` - Follow list management
- `FollowListModal.vue` - Follow list creation/edit modal
- `FollowListViewModal.vue` - Follow list viewing modal
- `FollowMergeNotification.vue` - Notifications for follow list merges
- `UserSearchInput.vue` - User search component

**Composables:**
- `useAudience.js` - Audience data and analytics
- `useFollowLists.js` - Follow list management

### Badges (`badges/`)
Components for displaying and managing Nostr badges.

**Components:**
- `BadgeDetailModal.vue` - Badge detail view
- `BadgeDisplay.vue` - Badge display component
- `BadgeList.vue` - List of badges

### Campaigns (`campaigns/`)
Components and composables for fundraising campaigns.

**Components:**
- `CampaignCard.vue` - Campaign card display
- `CampaignCreateModal.vue` - Create new campaign
- `CampaignDeleteModal.vue` - Delete campaign confirmation
- `CampaignShareModal.vue` - Share campaign
- `CampaignZapModal.vue` - Zap to campaign modal

**Composables:**
- `useCampaigns.js` - Campaign management logic

### Content (`content/`)
Components and composables for creating and managing Nostr content (long-form articles, short notes).

**Components:**
- `BlogEditor.vue` - Long-form article editor
- `ContentForm.vue` - Content creation form
- `ContentList.vue` - List of content items
- `ContentPerformance.vue` - Content analytics
- `ContentRenderer.vue` - Content display renderer
- `ContentStats.vue` - Content statistics
- `MediaEmbed.vue` - Media embedding
- `MentionInput.vue` - User mention input
- `MentionRenderer.vue` - Mention rendering
- `NostrReference.vue` - Nostr event references

**Composables:**
- `useContent.js` - Content management
- `useContentZaps.js` - Content zap tracking
- `useMentions.js` - User mentions handling
- `useNostrCalendar.js` - Calendar event management
- `useNostrContent.js` - Nostr content operations
- `useNostrLongForm.js` - Long-form article (NIP-23) operations
- `useNostrNotes.js` - Short note operations

**Utils:**
- `contentEncryption.js` - Content encryption/decryption
- `contentService.js` - Content processing service

### Media (`media/`)
Media library for uploading, browsing, and managing files via Blossom servers.

**Components:**
- `MediaLibrary.vue` - Main orchestrator with grid/list toggle, search, bulk actions
- `MediaGrid.vue` - Card-based grid view
- `MediaList.vue` - Table-style list view with sortable columns
- `MediaItem.vue` - Individual media card (thumbnail, overlay actions, action bar)
- `MediaFilters.vue` - Type filter chips (all/image/video/audio) and sort dropdown
- `MediaPreview.vue` - Fullscreen lightbox with keyboard navigation
- `MediaUploader.vue` - Drag-and-drop upload zone
- `ServerIndicator.vue` - Blossom server status indicator

**Composables:**
- `useMediaState.js` - Shared media state (files, filters, counts)
- `useBlossom.js` - Blossom server upload/delete operations

### Layout (`layout/`)
Core layout components.

**Components:**
- `Sidebar.vue` - Main navigation sidebar
- `TopBar.vue` - Top navigation bar

### Modals (`modals/`)
Modal dialog components.

**Components:**
- `HelpModal.vue` - Help and onboarding modal
- `NoteSuccessModal.vue` - Note published success
- `NostrProfileShareModal.vue` - Profile sharing
- `ProfileModal.vue` - Profile viewing modal
- `UserProfileModal.vue` - User profile modal
- `WelcomeModal.vue` - Welcome/onboarding modal
- `ZapEventModal.vue` - Zap event details

### Profile (`profile/`)
Profile-related components and utilities.

**Components:**
- `NostrProfileEditor.vue` - Profile editing
- `ProfileCard.vue` - Profile card display

**Utils:**
- `avatarGenerator.js` - Avatar generation
- `followMergeUtils.js` - Follow list merge utilities
- `profileFetcher.js` - Profile data fetching

### Settings (`settings/`)
Settings and configuration components.

**Components:**
- `AccountReset.vue` - Account reset functionality
- `NotificationSettings.vue` - Notification preferences
- `NostrSettings.vue` - Nostr account settings
- `SettingsConnections.vue` - Connection management

### Shared (`shared/`)
Shared components used across features.

**Components:**
- `EmptyStateDashboard.vue` - Empty state for dashboard
- `ErrorBoundary.vue` - Error boundary
- `Filters.vue` - Filter components
- `LoadingStateDashboard.vue` - Loading state
- `NotificationDropdown.vue` - Notification dropdown
- `SkeletonCard.vue` - Skeleton loading card
- `SkeletonChart.vue` - Skeleton loading chart
- `SkeletonList.vue` - Skeleton loading list
- `SkeletonTable.vue` - Skeleton loading table
- `SuggestionsTab.vue` - User suggestions

### Wallet (`wallet/`)
Lightning wallet and NWC components.

**Components:**
- `NWCConnection.vue` - Nostr Wallet Connect setup

**Composables:**
- `useLightningNetwork.js` - Lightning Network operations

**Utils:**
- `invoiceUtils.js` - Invoice handling
- `nwcClient.js` - NWC client implementation
- `nwcPayment.js` - Payment processing

### Zaps (`zaps/`)
Zap feed and Lightning Network visualization.

**Components:**
- `LightningNetworkDashboard.vue` - Lightning Network dashboard
- `LightningNetworkMap.vue` - Network visualization
- `LightningStats.vue` - Lightning stats display
- `ZapFeed.vue` - Real-time zap feed

### Core Utilities (`utils/core/`)
General-purpose utilities used across the application.

**Files:**
- `dataMapper.js` - Data transformation utilities
- `dateUtils.js` - Date formatting and manipulation
- `timeFilter.js` - Time filtering utilities

### Network Utilities (`utils/network/`)
Nostr relay and Lightning Network utilities.

**Files:**
- `lightningNetworkService.js` - Lightning Network service
- `lightningStatsService.js` - Lightning stats fetching
- `nostrRelayManager.js` - Nostr relay connection management

### Core Composables (`composables/core/`)
Core application-wide composables.

**Files:**
- `useBtcPrice.js` - Bitcoin price tracking
- `useNostrConnections.js` - Nostr connection management
- `useNotifications.js` - Notification system

### Auth Composables (`composables/auth/`)
Authentication and user management.

**Files:**
- `useNostrAuth.js` - Nostr authentication

### Social Composables (`composables/social/`)
Social features.

**Files:**
- `useBadges.js` - Badge management
- `useNostrChat.js` - Chat functionality

## Import Patterns

### From Components to Other Resources

```javascript
// From components/{category}/ to composables
import { useX } from '../../composables/{category}/useX.js'

// From components/{category}/ to utils
import { utilFunction } from '../../utils/{category}/utilFile.js'

// From components/{category}/ to sibling components
import Component from './Component.vue'

// From components/{category}/ to other component categories
import Component from '../{otherCategory}/Component.vue'
```

### From Composables

```javascript
// From composables/{category}/ to other composables
import { useX } from '../{otherCategory}/useX.js'

// From composables/{category}/ to utils
import { utilFunction } from '../../utils/{category}/utilFile.js'
```

### From Utils

```javascript
// From utils/{category}/ to other utils
import { utilFunction } from '../{otherCategory}/utilFile.js'
```

## Adding New Features

When adding a new feature:

1. **Determine the feature domain** - Does it fit into an existing category or need a new one?

2. **Create components** in `components/{category}/`

3. **Create composables** in `composables/{category}/` for business logic

4. **Create utilities** in `utils/{category}/` for pure functions

5. **Follow the import patterns** described above

6. **Keep features self-contained** - A feature should have minimal dependencies on other features

## Best Practices

1. **Colocate related files** - Keep files that change together close together
2. **Use descriptive names** - File names should clearly indicate their purpose
3. **Keep components focused** - Each component should have a single responsibility
4. **Extract reusable logic** - Move shared logic to composables or utilities
5. **Avoid circular dependencies** - Structure imports to flow in one direction

## Questions?

If you're unsure where something belongs, look for similar existing features or ask in the project discussions.

---

## Related Documentation

- [README.md](README.md) - Project overview and quick start
- [GUIDE.md](GUIDE.md) - Comprehensive user guide
- [use_cases.md](use_cases.md) - Real-world usage scenarios
- [nip07.md](nip07.md) - NIP-07 browser extension specification
