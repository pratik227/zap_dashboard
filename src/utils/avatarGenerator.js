import { createAvatar } from '@dicebear/core'
import { avataaars, micah, openPeeps } from '@dicebear/collection'

const AVATAR_STYLES = [avataaars, micah, openPeeps]

const BRAND_COLORS = [
  ['#f97316', '#fb923c', '#fdba74'],
  ['#ea580c', '#fb923c', '#fbbf24'],
  ['#f59e0b', '#fbbf24', '#fde047'],
  ['#f97316', '#fbbf24', '#fdba74'],
  ['#ea580c', '#fde047', '#fb923c'],
  ['#f59e0b', '#fdba74', '#fb923c']
]

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

export function generateAvatar(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    return generateDefaultAvatar()
  }

  try {
    const hash = simpleHash(pubkey)

    const styleIndex = hash % AVATAR_STYLES.length
    const selectedStyle = AVATAR_STYLES[styleIndex]

    const colorPaletteIndex = hash % BRAND_COLORS.length
    const backgroundColor = BRAND_COLORS[colorPaletteIndex]

    const avatar = createAvatar(selectedStyle, {
      seed: pubkey,
      backgroundColor: backgroundColor,
      size: 128,
      radius: 50,
    })

    const svg = avatar.toString()
    const base64 = btoa(unescape(encodeURIComponent(svg)))
    return `data:image/svg+xml;base64,${base64}`
  } catch (error) {
    console.error('Error generating avatar:', error)
    return generateDefaultAvatar()
  }
}

function generateDefaultAvatar() {
  const randomSeed = Math.random().toString(36).substring(7)

  try {
    const avatar = createAvatar(avataaars, {
      seed: randomSeed,
      backgroundColor: ['#f97316', '#fb923c', '#fdba74'],
      size: 128,
      radius: 50,
    })

    const svg = avatar.toString()
    const base64 = btoa(unescape(encodeURIComponent(svg)))
    return `data:image/svg+xml;base64,${base64}`
  } catch (error) {
    console.error('Error generating default avatar:', error)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2Y5NzMxNiIvPjwvc3ZnPg=='
  }
}
