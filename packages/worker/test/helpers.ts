import { createWorkerApp, MemoryStorage } from '../src/index'
import type { Env } from '../src/storage'

export const authHeaders = {
  authorization: 'Bearer test-token',
  'content-type': 'application/json',
}

export function testApp() {
  const storage = new MemoryStorage()
  const app = createWorkerApp(() => storage)
  const env = { CODEPUSHGO_API_KEY: 'test-token' } as Env
  return { app, env, storage }
}
