import { MMKV } from 'react-native-mmkv'
import { hashQueryKey, QueryKey } from 'react-query'

const _storage: { [serverId: string]: MMKV } = {}

export const storage = (serverId: string): MMKV => {
  if (!(serverId in _storage)) {
    _storage[serverId] = new MMKV({ id: `download-cache-${serverId}` })
  }
  return _storage[serverId]
}

const downloadCache = (serverId: string) => {
  return {
    get: (key: QueryKey) => {
      const value = storage(serverId).getString(hashQueryKey(key))
      return value !== undefined ? JSON.parse(value) : undefined
    },
    set: (key: QueryKey, value: any) => storage(serverId).set(hashQueryKey(key), JSON.stringify(value)),
  }
}

export default downloadCache
