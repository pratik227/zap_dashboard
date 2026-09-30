import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DeskQuoteComposer from '../../src/components/socialdesk/DeskQuoteComposer.vue'

const {
  mockSignAndPublish,
  mockNeventEncode
} = vi.hoisted(() => ({
  mockSignAndPublish: vi.fn(),
  mockNeventEncode: vi.fn()
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  neventEncode: mockNeventEncode
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

describe('DeskQuoteComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNeventEncode.mockReturnValue('nevent1quoted')
    mockSignAndPublish.mockResolvedValue({ event: { id: 'quote-event-id' } })
  })

  it('publishes a quote note with q and p tags plus a nostr link', async () => {
    const wrapper = mount(DeskQuoteComposer, {
      props: {
        post: {
          id: 'post-1',
          content: 'Original note',
          rawEvent: {
            id: 'target-event-id',
            pubkey: 'author-pubkey'
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

    await wrapper.find('textarea').setValue('My take')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(mockNeventEncode).toHaveBeenCalledWith({ id: 'target-event-id' })
    expect(mockSignAndPublish).toHaveBeenCalledWith({
      kind: 1,
      content: 'My take\n\nnostr:nevent1quoted',
      tags: [
        ['q', 'target-event-id'],
        ['p', 'author-pubkey']
      ]
    })
    expect(wrapper.emitted('sent')).toEqual([[{ eventId: 'quote-event-id', postId: 'post-1' }]])
  })

  it('shows a friendly error when the target post is incomplete', async () => {
    const wrapper = mount(DeskQuoteComposer, {
      props: {
        post: {
          id: 'post-1',
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

    expect(mockSignAndPublish).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cannot quote')
    expect(wrapper.emitted('sent')).toBeUndefined()
  })
})
