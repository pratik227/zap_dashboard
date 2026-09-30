import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DeskColumnSettings from '../../src/components/socialdesk/DeskColumnSettings.vue'
import { COLUMN_TYPES } from '../../src/composables/social/useDeskColumns.js'

vi.mock('../../src/components/audience/UserSearchInput.vue', () => ({
  default: defineComponent({
    name: 'UserSearchInput',
    emits: ['user-selected'],
    setup(_props, { emit }) {
      return () => h('button', {
        class: 'user-search-trigger',
        onClick: () => emit('user-selected', {
          pubkey: 'selected-pubkey',
          name: 'Selected User',
          nip05: 'selected@example.com'
        })
      }, 'Search user')
    }
  })
}))

describe('DeskColumnSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      cb()
      return 1
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('auto-updates the label for default hashtag columns when the filter changes', async () => {
    const wrapper = mount(DeskColumnSettings, {
      props: {
        column: {
          id: 'col-1',
          type: COLUMN_TYPES.HASHTAG,
          label: '#nostr',
          filter: 'nostr'
        }
      }
    })

    const inputs = wrapper.findAll('input')
    await inputs[1].setValue('#bitcoin')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      [{ filter: 'bitcoin', label: '#bitcoin' }]
    ])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('preserves a custom label when the hashtag filter changes', async () => {
    const wrapper = mount(DeskColumnSettings, {
      props: {
        column: {
          id: 'col-1',
          type: COLUMN_TYPES.HASHTAG,
          label: 'My Feed',
          filter: 'nostr'
        }
      }
    })

    const inputs = wrapper.findAll('input')
    await inputs[1].setValue('bitcoin')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      [{ filter: 'bitcoin' }]
    ])
  })

  it('blocks save when the filter is empty for filtered columns', async () => {
    const wrapper = mount(DeskColumnSettings, {
      props: {
        column: {
          id: 'col-1',
          type: COLUMN_TYPES.HASHTAG,
          label: '#nostr',
          filter: 'nostr'
        }
      }
    })

    const inputs = wrapper.findAll('input')
    await inputs[1].setValue('   ')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.text()).toContain('Hashtag cannot be empty')
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('requires selecting a user before saving user columns', async () => {
    const wrapper = mount(DeskColumnSettings, {
      props: {
        column: {
          id: 'col-2',
          type: COLUMN_TYPES.USER,
          label: 'Alice',
          filter: ''
        }
      }
    })

    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.text()).toContain('Select a user')
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('saves selected users from the search component', async () => {
    const wrapper = mount(DeskColumnSettings, {
      props: {
        column: {
          id: 'col-2',
          type: COLUMN_TYPES.USER,
          label: 'Alice',
          filter: 'old-pubkey'
        }
      }
    })

    await wrapper.find('.user-search-trigger').trigger('click')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      [{ filter: 'selected-pubkey', label: 'Selected User' }]
    ])
  })

  it('closes when clicking outside the popover', async () => {
    const wrapper = mount(DeskColumnSettings, {
      attachTo: document.body,
      props: {
        column: {
          id: 'col-1',
          type: COLUMN_TYPES.GLOBAL,
          label: 'Global',
          filter: ''
        }
      }
    })

    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
