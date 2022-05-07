import GradientFlatList from '@app/components/GradientFlatList'
import { SongListItem } from '@app/components/ListItem'
import NowPlayingBar from '@app/components/NowPlayingBar'
import { Song } from '@app/models/library'
import { useStore, useStoreDeep } from '@app/state/store'
import { listItemDefaultLayout } from '@app/styles/dimensions'
import React from 'react'
import { StyleSheet, View } from 'react-native'

const SongRenderItem: React.FC<{
  item: {
    song: Song
    i: number
    onPress: () => void
  }
}> = ({ item }) => (
  <SongListItem
    song={item.song}
    queueId={item.i}
    onPress={item.onPress}
    showArt={true}
    style={styles.listItem}
    subtitle="artist-album"
  />
)

const NowPlayingQueue = React.memo<{}>(() => {
  const queue = useStoreDeep(store => store.session?.queue)
  const skipTo = useStore(store => store.skip)

  if (!queue) {
    return <></>
  }

  return (
    <View style={styles.container}>
      <GradientFlatList
        data={queue.map((song, i) => ({ song, i, onPress: () => skipTo(i) }))}
        renderItem={SongRenderItem}
        keyExtractor={(item, i) => i.toString()}
        overScrollMode="never"
        windowSize={7}
        contentMarginTop={10}
        getItemLayout={listItemDefaultLayout}
      />
      <NowPlayingBar />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listItem: {
    paddingHorizontal: 20,
  },
})

export default NowPlayingQueue
