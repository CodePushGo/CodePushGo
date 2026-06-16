import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { isPhotoSelectionCancelledError, pickPhoto, takePhoto } from './photos'

describe('[Capgo parity] photo helpers', () => {
  it('matches photo cancellation errors', () => {
    expect(isPhotoSelectionCancelledError(new Error('User cancelled photos app'))).toBe(true)
    expect(isPhotoSelectionCancelledError({ message: 'User canceled image selection' })).toBe(true)
    expect(isPhotoSelectionCancelledError('The user cancelled image picking')).toBe(true)
    expect(isPhotoSelectionCancelledError(new Error('Camera permission denied'))).toBe(false)
  })

  it('swallows cancelled camera capture errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const isLoading = ref(false)

    await expect(takePhoto('update-account', isLoading, 'user', 'went-wrong', async () => {
      throw new Error('User cancelled photos app')
    })).resolves.toBeUndefined()

    expect(isLoading.value).toBe(false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('swallows cancelled image picker errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const isLoading = ref(false)

    await expect(pickPhoto('update-org', isLoading, 'org', 'went-wrong', async () => {
      throw { message: 'User canceled photos app' }
    })).resolves.toBeUndefined()

    expect(isLoading.value).toBe(false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('still logs unexpected camera capture errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const isLoading = ref(false)

    await expect(takePhoto('update-org', isLoading, 'org', 'went-wrong', async () => {
      throw new Error('Camera permission denied')
    })).resolves.toBeUndefined()

    expect(isLoading.value).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
    consoleErrorSpy.mockRestore()
  })
})
