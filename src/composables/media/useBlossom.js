/**
 * useBlossom - Composable wrapping media state with auto-fetch, upload queue, and notifications
 */

import { onMounted, watch } from 'vue'
import { signerService } from '../../services/nostr/SignerService.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useMediaState } from './useMediaState.js'
import {
  getConfiguredServers,
  list,
  uploadToAll,
  deleteFile,
  signBlossomAuth,
  computeHash,
  BLOSSOM_MAX_FILE_SIZE
} from '../../services/blossomService.js'

export function useBlossom({ autoFetch = true } = {}) {
  const { isAuthenticated, currentUser } = useNostrAuth()
  const mediaState = useMediaState()

  function getPubkey() {
    return currentUser.value?.pubkey || null
  }

  async function signEvent(unsignedEvent) {
    if (!signerService.isConnected) return null
    return signerService.signEvent(unsignedEvent)
  }

  async function refresh() {
    const pubkey = getPubkey()
    if (!isAuthenticated.value || !pubkey) return

    mediaState.isLoading.value = true
    const servers = getConfiguredServers()

    try {
      const results = await Promise.allSettled(
        servers.map(server => list(server, pubkey, signEvent))
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          mediaState.mergeFiles(r.value)
        }
      }
    } catch (err) {
      console.error('Failed to fetch media:', err)
    } finally {
      mediaState.isLoading.value = false
    }
  }

  async function uploadFiles(fileList) {
    const pubkey = getPubkey()
    if (!pubkey) return []

    const servers = getConfiguredServers()
    const files = Array.from(fileList)
    const results = []

    for (const file of files) {
      if (file.size > BLOSSOM_MAX_FILE_SIZE) {
        results.push({ success: false, file: file.name, error: `${file.name} exceeds 20 MB limit` })
        continue
      }

      const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`

      mediaState.uploadQueue.value.set(tempId, {
        file,
        name: file.name,
        status: 'uploading',
        progress: 0,
        hash: null,
        error: null
      })

      try {
        const result = await uploadToAll(
          file,
          servers,
          pubkey,
          signEvent,
          (progress) => {
            const entry = mediaState.uploadQueue.value.get(tempId)
            if (entry) {
              entry.progress = progress
              mediaState.uploadQueue.value.set(tempId, { ...entry })
            }
          }
        )

        mediaState.addFile(result)
        mediaState.uploadQueue.value.delete(tempId)
        results.push({ success: true, file: file.name, result })

      } catch (err) {
        const entry = mediaState.uploadQueue.value.get(tempId)
        if (entry) {
          entry.status = 'error'
          entry.error = err.message
          mediaState.uploadQueue.value.set(tempId, { ...entry })
        }
        results.push({ success: false, file: file.name, error: err.message })
      }
    }

    return results
  }

  async function deleteFiles(hashes) {
    const pubkey = getPubkey()
    if (!pubkey) return 0

    const servers = getConfiguredServers()
    let deleted = 0

    for (const hash of hashes) {
      try {
        await Promise.allSettled(
          servers.map(async (server) => {
            const auth = await signBlossomAuth(
              'Delete file', 'delete', pubkey, signEvent, hash
            )
            return deleteFile(server, hash, auth)
          })
        )
        mediaState.removeFile(hash)
        deleted++
      } catch (err) {
        console.error(`Failed to delete ${hash}:`, err)
      }
    }

    return deleted
  }

  // Clear state on logout, auto-fetch on login
  watch(isAuthenticated, (authed) => {
    if (!authed) {
      mediaState.clearAll()
    }
  })

  // Auto-fetch on mount
  if (autoFetch) {
    onMounted(() => {
      if (isAuthenticated.value) {
        refresh()
      }
    })
  }

  return {
    refresh,
    uploadFiles,
    deleteFiles,
    computeHash
  }
}
