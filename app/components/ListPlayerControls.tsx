import Button from '@app/components/Button'
import { Song } from '@app/models/library'
import { createJobId } from '@app/state/download'
import { useStore, useStoreDeep } from '@app/state/store'
import colors from '@app/styles/colors'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Icon from 'react-native-vector-icons/Ionicons'
import IconMat from 'react-native-vector-icons/MaterialIcons'
import { withSuspenseMemo } from './withSuspense'

const useSongListDownload = (ids: string[]) => {
  const download = useStore(store => () => ids.forEach(id => store.downloadSong(id)))
  const serverId = useStore(store => store.settings.activeServerId)
  const jobs = useStoreDeep(store => {
    if (!serverId) {
      return
    }

    return ids.map(songId => store.downloadQueue.byId[createJobId({ songId, serverId })])
  })
  const isDownloaded = useStore(store => {
    if (!serverId) {
      return false
    }

    const downloads = store.downloads[serverId]
    if (!downloads) {
      return false
    }

    return ids.length > 0 && ids.every(id => id in downloads.songs)
  })
  const isFetching = useStore(store => {
    if (!serverId) {
      return false
    }

    if (store.downloadQueue.allIds.length > 0) {
      return ids.some(songId => createJobId({ songId, serverId }) === store.downloadQueue.allIds[0])
    }
    return false
  })
  const isPending = jobs !== undefined && jobs.some(j => j !== undefined)

  return { download, isFetching, isPending, isDownloaded }
}

const ListPlayerControls = withSuspenseMemo<{
  songs: Song[]
  listType: 'album' | 'playlist'
  style?: StyleProp<ViewStyle>
  play: () => void
  shuffle: () => void
  disabled?: boolean
}>(({ songs, listType, style, play, shuffle, disabled }) => {
  const { download, isPending, isDownloaded } = useSongListDownload(songs.map(s => s.id))
  const { t } = useTranslation()

  return (
    <View style={[styles.controls, style]}>
      <View style={styles.controlsSide}>
        <Button
          disabled={disabled || isPending}
          buttonStyle={isDownloaded ? 'hollow' : undefined}
          onPress={() => download()}>
          {isDownloaded ? (
            <IconMat name="file-download-done" size={26} color={colors.text.primary} />
          ) : isPending ? (
            <ActivityIndicator size={26} color={colors.text.primary} />
          ) : (
            <IconMat name="file-download" size={26} color={colors.text.primary} />
          )}
        </Button>
      </View>
      <View style={styles.controlsCenter}>
        <Button title={t(`resources.${listType}.actions.play`)} disabled={disabled} onPress={play} />
      </View>
      <View style={styles.controlsSide}>
        <Button disabled={disabled} onPress={shuffle}>
          <Icon name="shuffle" size={26} color="white" />
        </Button>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
  },
  controlsSide: {
    flex: 4,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlsCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '65%',
  },
})

export default ListPlayerControls
