import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../src/storage'

describe('[Capgo parity] public channel uniqueness', () => {
  it.concurrent('allows one public channel per platform', async () => {
    const storage = new MemoryStorage()
    const appId = 'com.public.channel.platform-defaults'

    await storage.upsertChannel({ appId, name: 'ios-public', public: true, ios: true, android: false, electron: false })
    await storage.upsertChannel({ appId, name: 'android-public', public: true, ios: false, android: true, electron: false })
    await storage.upsertChannel({ appId, name: 'electron-public', public: true, ios: false, android: false, electron: true })

    await expect(getChannelStates(storage, appId)).resolves.toMatchObject({
      'ios-public': true,
      'android-public': true,
      'electron-public': true,
    })
  })

  it.concurrent('demotes overlapping public electron channels on insert while preserving other platforms', async () => {
    const storage = new MemoryStorage()
    const appId = 'com.public.channel.insert'

    await storage.upsertChannel({ appId, name: 'ios-public', public: true, ios: true, android: false, electron: false })
    await storage.upsertChannel({ appId, name: 'android-public', public: true, ios: false, android: true, electron: false })
    await storage.upsertChannel({ appId, name: 'electron-public', public: true, ios: false, android: false, electron: true })
    await storage.upsertChannel({ appId, name: 'electron-next', public: true, ios: false, android: false, electron: true })

    await expect(getChannelStates(storage, appId)).resolves.toMatchObject({
      'ios-public': true,
      'android-public': true,
      'electron-public': false,
      'electron-next': true,
    })
  })

  it.concurrent('demotes overlapping public electron channels on update while preserving other platforms', async () => {
    const storage = new MemoryStorage()
    const appId = 'com.public.channel.update'

    await storage.upsertChannel({ appId, name: 'ios-public', public: true, ios: true, android: false, electron: false })
    await storage.upsertChannel({ appId, name: 'android-public', public: true, ios: false, android: true, electron: false })
    await storage.upsertChannel({ appId, name: 'electron-public', public: true, ios: false, android: false, electron: true })
    await storage.upsertChannel({ appId, name: 'electron-private', public: false, ios: false, android: false, electron: true })
    await storage.upsertChannel({ appId, name: 'electron-private', public: true, ios: false, android: false, electron: true })

    await expect(getChannelStates(storage, appId)).resolves.toMatchObject({
      'ios-public': true,
      'android-public': true,
      'electron-public': false,
      'electron-private': true,
    })
  })
})

async function getChannelStates(storage: MemoryStorage, appId: string) {
  const channels = await storage.listChannels(appId)
  return Object.fromEntries(channels.map(channel => [channel.name, channel.public]))
}
