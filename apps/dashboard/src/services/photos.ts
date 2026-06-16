import type { Ref } from 'vue'

function errorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
    return (error as { message: string }).message
  return typeof error === 'string' ? error : ''
}

export function isPhotoSelectionCancelledError(error: unknown) {
  return /\b(cancelled|canceled)\b/i.test(errorMessage(error))
}

export async function runPhotoSelection(action: () => Promise<unknown>, isLoading: Ref<boolean>) {
  isLoading.value = true
  try {
    await action()
  }
  catch (error) {
    if (!isPhotoSelectionCancelledError(error))
      console.error(error)
  }
  finally {
    isLoading.value = false
  }
}

export async function takePhoto(_eventName: string, isLoading: Ref<boolean>, _target: string, _errorMessage: string, action?: () => Promise<unknown>) {
  await runPhotoSelection(action ?? (async () => undefined), isLoading)
}

export async function pickPhoto(_eventName: string, isLoading: Ref<boolean>, _target: string, _errorMessage: string, action?: () => Promise<unknown>) {
  await runPhotoSelection(action ?? (async () => undefined), isLoading)
}
