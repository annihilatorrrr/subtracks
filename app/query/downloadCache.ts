import { MMKV } from 'react-native-mmkv'
import { QueryCache } from './queryCache'

const _storage: { [serverId: string]: MMKV } = {}

export const storage = (serverId: string): MMKV => {
  if (!(serverId in _storage)) {
    _storage[serverId] = new MMKV({ id: `download-cache-${serverId}` })
  }
  return _storage[serverId]
}

export function stringifyKey(key: any[]): string {
  return key.join('.')
}

const downloadCache = (serverId: string): QueryCache => {
  return {
    get: key => {
      const value = storage(serverId).getString(stringifyKey(key))
      return value !== undefined ? JSON.parse(value) : undefined
    },
    set: (key, value) => storage(serverId).set(stringifyKey(key), JSON.stringify(value)),
  }
}

export default downloadCache
