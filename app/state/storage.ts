import AsyncStorage from '@react-native-async-storage/async-storage'
import { MMKV } from 'react-native-mmkv'
import { StateStorage } from 'zustand/middleware'
import { useStore } from './store'

export const storage = new MMKV()

export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    return storage.set(name, value)
  },
  getItem: name => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: name => {
    return storage.delete(name)
  },
}

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export const hasMigratedFromAsyncStorage = storage.getBoolean('hasMigratedFromAsyncStorage')

// TODO: Remove `hasMigratedFromAsyncStorage` after a while (when everyone has migrated)
export async function migrateFromAsyncStorage(): Promise<void> {
  console.log('Migrating from AsyncStorage -> MMKV...')
  const start = global.performance.now()

  const keys = await AsyncStorage.getAllKeys()

  for (const key of keys) {
    console.log('key:', key)
    try {
      const value = await AsyncStorage.getItem(key)
      console.log('value:', value)

      if (value != null) {
        if (['true', 'false'].includes(value)) {
          storage.set(key, value === 'true')
        } else {
          storage.set(key, value)
        }

        // AsyncStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Failed to migrate key "${key}" from AsyncStorage to MMKV!`, error)
      throw error
    }
  }

  storage.set('hasMigratedFromAsyncStorage', true)

  await useStore.persist.rehydrate()

  const end = global.performance.now()
  console.log(`Migrated from AsyncStorage -> MMKV in ${end - start}ms!`)
}
