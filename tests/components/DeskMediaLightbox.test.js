import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DeskMediaLightbox from '../../src/components/socialdesk/DeskMediaLightbox.vue'

vi.mock('../../src/composables/core/useFocusTrap.js', () => ({
  useFocusTrap: vi.fn()
}))

describe('DeskMediaLightbox', () => {
  const media = [
    { url: 'https://cdn.example.com/one.jpg', alt: 'One', filename: 'one.jpg' },
    { url: 'https://cdn.example.com/two.jpg', alt: 'Two', filename: 'two.jpg' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['image'])
    }))
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('renders the active media and exposes actions', async () => {
    const wrapper = mount(DeskMediaLightbox, {
      props: {
        media,
        initialIndex: 1
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await nextTick()

    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.example.com/two.jpg')

    const links = wrapper.findAll('a')
    expect(links[0].attributes('href')).toBe('https://cdn.example.com/two.jpg')
  })

  it('downloads the current media via blob download flow', async () => {
    const wrapper = mount(DeskMediaLightbox, {
      props: {
        media,
        initialIndex: 0
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await nextTick()

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    await wrapper.find('button[aria-label="Download image"]').trigger('click')

    expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/one.jpg', { mode: 'cors' })
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('cycles through media with keyboard navigation and closes on escape', async () => {
    const wrapper = mount(DeskMediaLightbox, {
      props: {
        media,
        initialIndex: 0
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })

    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.example.com/two.jpg')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
