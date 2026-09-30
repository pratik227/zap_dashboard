import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DeskReplyComposer from '../../src/components/socialdesk/DeskReplyComposer.vue'

const {
  mockParseThread,
  mockBuildThreadTags,
  mockSignAndPublish
} = vi.hoisted(() => ({
  mockParseThread: vi.fn(),
  mockBuildThreadTags: vi.fn(),
  mockSignAndPublish: vi.fn()
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  nip10: {
    parseThread: mockParseThread,
    buildThreadTags: mockBuildThreadTags
  }
}))

vi.mock('../../src/composables/core/usePublish.js', () => ({
  usePublish: () => ({
    signAndPublish: mockSignAndPublish,
    isPublishing: ref(false)
  })
}))

vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    currentUser: ref({ pubkey: 'viewer-pubkey' }),
    userProfile: ref({ name: 'Viewer', picture: null })
  })
}))

vi.mock('../../src/composables/core/useFocusTrap.js', () => ({
  useFocusTrap: vi.fn()
}))

vi.mock('../../src/services/nostr/errors.js', () => ({
  getUserFriendlyError: (err) => err.message || 'Unknown error'
}))

vi.mock('../../src/utils/profile/avatarGenerator.js', () => ({
  generateAvatar: () => 'avatar.png'
}))

describe('DeskReplyComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildThreadTags.mockReturnValue([['e', 'root-id', '', 'root'], ['e', 'reply-id', '', 'reply']])
    mockSignAndPublish.mockResolvedValue({ event: { id: 'reply-event-id' } })
  })

  it('preserves the original thread root when replying to a reply', async () => {
    mockParseThread.mockReturnValue({ root: { id: 'original-root-id' } })

    const wrapper = mount(DeskReplyComposer, {
      props: {
        post: {
          content: 'Nested note',
          rawEvent: {
            id: 'current-reply-id',
            pubkey: 'author-pubkey',
            tags: [['e', 'original-root-id', '', 'root'], ['e', 'current-reply-id', '', 'reply']]
          },
          profile: { name: 'Alice' }
        }
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await wrapper.find('textarea').setValue('Reply body')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(mockBuildThreadTags).toHaveBeenCalledWith({
      root: { id: 'original-root-id', relay: '' },
      reply: { id: 'current-reply-id', relay: '' },
      profiles: ['author-pubkey']
    })
    expect(mockSignAndPublish).toHaveBeenCalledWith({
      kind: 1,
      content: 'Reply body',
      tags: [['e', 'root-id', '', 'root'], ['e', 'reply-id', '', 'reply']]
    })
    expect(wrapper.emitted('sent')).toHaveLength(1)

    wrapper.unmount()
  })

  it('falls back to replying to the current note when no thread root exists', async () => {
    mockParseThread.mockReturnValue(null)

    const wrapper = mount(DeskReplyComposer, {
      props: {
        post: {
          content: 'Top level note',
          rawEvent: {
            id: 'top-level-id',
            pubkey: 'author-pubkey',
            tags: []
          },
          profile: null
        }
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await wrapper.find('textarea').setValue('Top level reply')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(mockBuildThreadTags).toHaveBeenCalledWith({
      root: { id: 'top-level-id', relay: '' },
      reply: { id: 'top-level-id', relay: '' },
      profiles: ['author-pubkey']
    })
    expect(wrapper.emitted('sent')).toHaveLength(1)
  })

  it('shows a friendly error when the target post is incomplete', async () => {
    const wrapper = mount(DeskReplyComposer, {
      props: {
        post: {
          content: 'Broken note',
          rawEvent: null
        }
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await wrapper.find('textarea').setValue('Will fail')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(mockBuildThreadTags).not.toHaveBeenCalled()
    expect(mockSignAndPublish).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cannot reply')
    expect(wrapper.emitted('sent')).toBeUndefined()
  })
})
