import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, defineComponent, h } from 'vue'

const columns = ref([])
const mockSignAndPublish = vi.fn()
const mockRecordLocalEvent = vi.fn()
const mockGetInteractions = vi.fn()
const mockAddColumn = vi.fn()
const mockRemoveColumn = vi.fn()
const mockUpdateColumn = vi.fn()
const mockCreateReactionEventTemplate = vi.fn((rawEvent, content) => ({ kind: 7, content, tags: [['e', rawEvent.id]] }))
const mockCreateRepostEventTemplate = vi.fn((rawEvent) => ({ kind: 6, content: '', tags: [['e', rawEvent.id]] }))
const mockGetEngagementCounts = vi.fn()
const mockStartLongFormContentTracking = vi.fn()
const mockStartEngagementTracking = vi.fn()
const mockStartZapTracking = vi.fn()
const mockGetZapCount = vi.fn()

const DeskColumnStub = defineComponent({
  name: 'DeskColumn',
  props: {
    column: { type: Object, required: true },
    getActionState: { type: Function, default: () => ({}) }
  },
  emits: ['react', 'repost', 'quote', 'reply', 'zap', 'profile-click', 'media-open', 'article-open', 'remove', 'update'],
  setup(props, { emit }) {
    const post = computed(() => ({
      id: `post-${props.column.id}`,
      pubkey: `pubkey-${props.column.id}`,
      content: `content-${props.column.id}`,
      rawEvent: {
        id: `raw-${props.column.id}`,
        pubkey: `pubkey-${props.column.id}`,
        tags: []
      },
      profile: {
        name: `Profile ${props.column.label}`
      }
    }))

    return () => h('div', { class: 'desk-column-stub' }, [
      h('div', { class: 'column-label' }, props.column.label),
      h('button', {
        class: 'react-trigger',
        onClick: () => emit('react', post.value)
      }, 'React'),
      h('button', {
        class: 'repost-trigger',
        onClick: () => emit('repost', post.value)
      }, 'Repost'),
      h('button', {
        class: 'quote-trigger',
        onClick: () => emit('quote', post.value)
      }, 'Quote'),
      h('button', {
        class: 'media-trigger',
        onClick: () => emit('media-open', {
          post: post.value,
          media: [{ url: `https://cdn.example.com/${props.column.id}.jpg`, alt: 'Media', filename: `${props.column.id}.jpg` }],
          index: 0
        })
      }, 'Media'),
      h('button', {
        class: 'article-trigger',
        onClick: () => emit('article-open', post.value)
      }, 'Article'),
      h('button', {
        class: 'swipe-test-button'
      }, 'Inner button')
    ])
  }
})

vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    isAuthenticated: ref(true),
    currentUser: ref({ pubkey: 'viewer-pubkey' }),
    userProfile: ref(null),
    login: vi.fn(),
    isLoading: ref(false)
  })
}))

vi.mock('../../src/composables/social/useDeskColumns.js', () => ({
  COLUMN_TYPES: {
    HASHTAG: 'hashtag',
    USER: 'user',
    FOLLOWING: 'following',
    MENTIONS: 'mentions',
    GLOBAL: 'global',
    LONGFORM: 'longform'
  },
  LONGFORM_FILTER_MODES: {
    TAG: 'tag',
    USER: 'user'
  },
  createLongformFilter: vi.fn((mode, value) => `${mode}:${value}`),
  useDeskColumns: () => ({
    columns,
    columnCount: computed(() => columns.value.length),
    canAddColumn: computed(() => columns.value.length < 6),
    hasColumns: computed(() => columns.value.length > 0),
    maxColumns: 6,
    addColumn: mockAddColumn,
    removeColumn: mockRemoveColumn,
    updateColumn: mockUpdateColumn
  })
}))

vi.mock('../../src/composables/social/useDeskInteractions.js', () => ({
  useDeskInteractions: () => ({
    getInteractions: mockGetInteractions,
    recordLocalEvent: mockRecordLocalEvent
  })
}))

vi.mock('../../src/composables/analytics/useEngagementMetrics.js', () => ({
  useEngagementMetrics: () => ({
    getEngagementCounts: mockGetEngagementCounts,
    startLongFormContentTracking: mockStartLongFormContentTracking,
    startEngagementTracking: mockStartEngagementTracking
  })
}))

vi.mock('../../src/composables/content/useContentZaps.js', () => ({
  useContentZaps: () => ({
    startZapTracking: mockStartZapTracking,
    getZapCount: mockGetZapCount
  })
}))

vi.mock('../../src/composables/core/usePublish.js', () => ({
  usePublish: () => ({
    signAndPublish: mockSignAndPublish
  })
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  createReactionEventTemplate: mockCreateReactionEventTemplate,
  createRepostEventTemplate: mockCreateRepostEventTemplate
}))

vi.mock('../../src/services/nostr/errors.js', () => ({
  getUserFriendlyError: (err) => err.message || 'Unknown error'
}))

vi.mock('../../src/services/nostr/ProfileService.js', () => ({
  profileService: {
    getCached: vi.fn(() => null),
    get: vi.fn(async (pubkey) => ({ pubkey, name: `Fetched ${pubkey}` }))
  }
}))

vi.mock('../../src/components/socialdesk/DeskColumn.vue', () => ({
  default: DeskColumnStub
}))

vi.mock('../../src/components/socialdesk/DeskReplyComposer.vue', () => ({
  default: defineComponent({
    name: 'DeskReplyComposer',
    props: { post: { type: Object, default: null } },
    setup() {
      return () => h('div', { class: 'reply-composer-stub' }, 'ReplyComposer')
    }
  })
}))

vi.mock('../../src/components/socialdesk/DeskZapPopover.vue', () => ({
  default: defineComponent({
    name: 'DeskZapPopover',
    props: { post: { type: Object, default: null } },
    setup() {
      return () => h('div', { class: 'zap-popover-stub' }, 'ZapPopover')
    }
  })
}))

vi.mock('../../src/components/socialdesk/DeskMediaLightbox.vue', () => ({
  default: defineComponent({
    name: 'DeskMediaLightbox',
    props: {
      media: { type: Array, default: () => [] },
      initialIndex: { type: Number, default: 0 }
    },
    emits: ['close'],
    setup(props) {
      return () => h('div', { class: 'media-lightbox-stub' }, `${props.media[props.initialIndex]?.url || 'media'}`)
    }
  })
}))

vi.mock('../../src/components/socialdesk/DeskArticleViewer.vue', () => ({
  default: defineComponent({
    name: 'DeskArticleViewer',
    props: {
      post: { type: Object, required: true },
      engagementCounts: { type: Object, default: () => ({ likes: 0, reposts: 0, bookmarks: 0, totalEngagement: 0 }) },
      articleMetrics: { type: Object, default: () => ({ reactions: 0, reposts: 0, replies: 0, zaps: 0 }) },
      zapCount: { type: Number, default: 0 }
    },
    setup(props) {
      return () => h('div', { class: 'article-viewer-stub' }, [
        h('span', { class: 'article-viewer-event' }, props.post.rawEvent?.id || props.post.id),
        h('span', { class: 'article-viewer-likes' }, String(props.engagementCounts.likes)),
        h('span', { class: 'article-viewer-replies' }, String(props.articleMetrics.replies)),
        h('span', { class: 'article-viewer-zaps' }, String(props.zapCount))
      ])
    }
  })
}))

vi.mock('../../src/components/socialdesk/DeskQuoteComposer.vue', () => ({
  default: defineComponent({
    name: 'DeskQuoteComposer',
    props: { post: { type: Object, default: null } },
    emits: ['close', 'sent'],
    setup(_props, { emit }) {
      return () => h('div', { class: 'quote-composer-stub' }, [
        h('button', {
          class: 'quote-send-trigger',
          onClick: () => emit('sent', { eventId: 'quote-event-id', postId: _props.post?.id })
        }, 'Send quote')
      ])
    }
  })
}))

vi.mock('../../src/components/modals/UserProfileModal.vue', () => ({
  default: defineComponent({
    name: 'UserProfileModal',
    props: {
      show: { type: Boolean, default: false },
      userProfileData: { type: Object, default: null }
    },
    setup(props) {
      return () => props.show ? h('div', { class: 'user-profile-modal-stub' }, props.userProfileData?.pubkey || 'profile') : null
    }
  })
}))

vi.mock('../../src/components/audience/UserSearchInput.vue', () => ({
  default: defineComponent({
    name: 'UserSearchInput',
    emits: ['user-selected'],
    setup(_props, { emit }) {
      return () => h('button', {
        class: 'user-search-trigger',
        onClick: () => emit('user-selected', {
          pubkey: 'searched-pubkey',
          name: 'Searched User',
          nip05: 'searched@example.com'
        })
      }, 'Search user')
    }
  })
}))

describe('SocialDesk', () => {
  let SocialDesk

  beforeEach(async () => {
    vi.clearAllMocks()
    columns.value = [
      { id: 'one', type: 'global', label: 'Column One', filter: '' },
      { id: 'two', type: 'global', label: 'Column Two', filter: '' },
      { id: 'three', type: 'global', label: 'Column Three', filter: '' }
    ]

    mockGetInteractions.mockImplementation((postId) => ({
      reactions: 0,
      reposts: 0,
      replies: 3,
      zaps: 0,
      myReaction: false,
      myRepost: false,
      postId
    }))
    mockGetEngagementCounts.mockImplementation(() => ({
      likes: 7,
      reposts: 4,
      bookmarks: 0,
      totalEngagement: 11
    }))
    mockGetZapCount.mockImplementation(() => 5)

    vi.resetModules()
    SocialDesk = (await import('../../src/pages/SocialDesk.vue')).default
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks react publishes while a request is in flight', async () => {
    let resolvePublish
    mockSignAndPublish.mockImplementation(() => new Promise((resolve) => {
      resolvePublish = resolve
    }))

    const wrapper = mount(SocialDesk)
    const reactButtons = wrapper.findAll('.react-trigger')

    await reactButtons[0].trigger('click')
    await reactButtons[0].trigger('click')

    expect(mockSignAndPublish).toHaveBeenCalledTimes(1)

    resolvePublish({ event: { id: 'reaction-event-id' } })
    await Promise.resolve()
    await Promise.resolve()

    expect(mockRecordLocalEvent).toHaveBeenCalledWith('post-one', 7, 'reaction-event-id')
  })

  it('switches mobile columns only when the swipe passes the threshold', async () => {
    const wrapper = mount(SocialDesk)
    const swipeContainer = wrapper.find('div.overflow-hidden.relative')

    expect(swipeContainer.text()).toContain('Column One')

    await swipeContainer.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 0 }]
    })
    await swipeContainer.trigger('touchmove', {
      touches: [{ clientX: 170, clientY: 2 }],
      preventDefault: vi.fn()
    })
    await swipeContainer.trigger('touchend')

    expect(swipeContainer.text()).toContain('Column One')

    await swipeContainer.trigger('touchstart', {
      touches: [{ clientX: 220, clientY: 0 }]
    })
    await swipeContainer.trigger('touchmove', {
      touches: [{ clientX: 120, clientY: 4 }],
      preventDefault: vi.fn()
    })
    await swipeContainer.trigger('touchend')

    expect(swipeContainer.text()).toContain('Column Two')
  })

  it('does not start swipe navigation from interactive child elements', async () => {
    const wrapper = mount(SocialDesk)
    const swipeContainer = wrapper.find('div.overflow-hidden.relative')
    const innerButton = swipeContainer.find('.swipe-test-button')

    expect(swipeContainer.text()).toContain('Column One')

    await innerButton.trigger('touchstart', {
      touches: [{ clientX: 220, clientY: 0 }]
    })
    await swipeContainer.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 0 }],
      preventDefault: vi.fn()
    })
    await swipeContainer.trigger('touchend')

    expect(swipeContainer.text()).toContain('Column One')
  })

  it('records quote reposts as repost interactions after quote publish', async () => {
    const wrapper = mount(SocialDesk)

    await wrapper.findAll('.quote-trigger')[0].trigger('click')
    expect(wrapper.find('.quote-composer-stub').exists()).toBe(true)

    await wrapper.find('.quote-send-trigger').trigger('click')

    expect(mockRecordLocalEvent).toHaveBeenCalledWith('post-one', 16, 'quote-event-id')
    expect(wrapper.find('.quote-composer-stub').exists()).toBe(false)
  })

  it('opens the media lightbox when a post image is selected', async () => {
    const wrapper = mount(SocialDesk)

    await wrapper.findAll('.media-trigger')[0].trigger('click')

    expect(wrapper.find('.media-lightbox-stub').exists()).toBe(true)
    expect(wrapper.find('.media-lightbox-stub').text()).toContain('https://cdn.example.com/one.jpg')
  })

  it('opens longform content in the article experience', async () => {
    const wrapper = mount(SocialDesk)

    await wrapper.findAll('.article-trigger')[0].trigger('click')

    expect(mockStartZapTracking).toHaveBeenCalledWith('raw-one')
    expect(mockStartEngagementTracking).toHaveBeenCalledWith('raw-one')
    expect(wrapper.find('.article-viewer-stub').exists()).toBe(true)
    expect(wrapper.find('.article-viewer-event').text()).toBe('raw-one')
    expect(wrapper.find('.article-viewer-likes').text()).toBe('7')
    expect(wrapper.find('.article-viewer-replies').text()).toBe('3')
    expect(wrapper.find('.article-viewer-zaps').text()).toBe('5')
  })
})
