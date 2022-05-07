import GradientFlatList from '@app/components/GradientFlatList'
import { PlaylistListItem } from '@app/components/ListItem'
import { useQueryPlaylists } from '@app/hooks/query'
import { Playlist } from '@app/models/library'
import { listItemBig, listItemBigLayout } from '@app/styles/dimensions'
import { mapById } from '@app/util/state'
import React from 'react'
import { StyleSheet } from 'react-native'

const PlaylistRenderItem: React.FC<{ item: Playlist }> = ({ item }) => (
  <PlaylistListItem playlist={item} showArt={true} size={listItemBig.size} style={styles.listItem} />
)

const PlaylistsList = () => {
  const { isLoading, data, refetch } = useQueryPlaylists()

  return (
    <GradientFlatList
      data={data ? mapById(data?.byId, data?.allIds) : []}
      renderItem={PlaylistRenderItem}
      keyExtractor={item => item.id}
      onRefresh={refetch}
      refreshing={isLoading}
      overScrollMode="never"
      windowSize={5}
      contentMarginTop={6}
      getItemLayout={listItemBigLayout}
    />
  )
}

const styles = StyleSheet.create({
  listItem: {
    paddingHorizontal: 10,
    marginBottom: listItemBig.marginBottom,
  },
})

export default PlaylistsList
