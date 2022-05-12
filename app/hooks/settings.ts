import { CacheItemTypeKey } from '@app/models/cache'
import queryClient from '@app/query/queryClient'
import { qkFilters } from '@app/query/queryKeys'
import { useStore, useStoreDeep } from '@app/state/store'
import cacheDir from '@app/util/cacheDir'
import RNFS from 'react-native-fs'

export const useSwitchActiveServer = () => {
  const activeServerId = useStore(store => store.settings.activeServerId)
  const setActiveServer = useStore(store => store.setActiveServer)
  const destroyPlayer = useStore(store => store.destroy)

  return async (id: string) => {
    if (id === activeServerId) {
      return
    }

    await queryClient.cancelQueries(undefined, { active: true })
    await destroyPlayer()
    queryClient.removeQueries()
    setActiveServer(id)
  }
}

export const useFirstRun = () => {
  return useStore(store => Object.keys(store.settings.servers).length === 0)
}

export const useResetImageCache = () => {
  const serverIds = useStoreDeep(store => Object.keys(store.settings.servers))
  const changeCacheBuster = useStore(store => store.changeCacheBuster)
  const setDisableMusicTabs = useStore(store => store.setDisableMusicTabs)

  return async () => {
    setDisableMusicTabs(true)

    try {
      // disable/invalidate queries
      await Promise.all([
        queryClient.cancelQueries(qkFilters.artistArt(), { active: true }),
        queryClient.cancelQueries(qkFilters.coverArt(), { active: true }),
        queryClient.cancelQueries(qkFilters.existingFiles(), { active: true }),
        queryClient.invalidateQueries(qkFilters.artistArt(), { refetchActive: false }),
        queryClient.invalidateQueries(qkFilters.coverArt(), { refetchActive: false }),
        queryClient.invalidateQueries(qkFilters.existingFiles(), { refetchActive: false }),
      ])

      // delete all images
      const itemTypes: CacheItemTypeKey[] = ['artistArt', 'artistArtThumb', 'coverArt', 'coverArtThumb']
      await Promise.all(
        serverIds.flatMap(id =>
          itemTypes.map(async type => {
            const dir = cacheDir(id, type)
            try {
              await RNFS.unlink(dir)
            } catch {}
          }),
        ),
      )

      // change cacheBuster
      changeCacheBuster()
    } finally {
      setDisableMusicTabs(false)

      // enable queries
      await Promise.all([
        queryClient.refetchQueries(qkFilters.existingFiles(), { active: true }),
        queryClient.refetchQueries(qkFilters.artistArt(), { active: true }),
        queryClient.refetchQueries(qkFilters.coverArt(), { active: true }),
      ])
    }
  }
}
