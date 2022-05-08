import GradientFlatList from '@app/components/GradientFlatList'
import { LIST_ITEM_BIG, PlaylistListItem } from '@app/components/ListItem'
import { useQueryPlaylists } from '@app/hooks/query'
import { Playlist } from '@app/models/library'
import { mapById } from '@app/util/state'
import React from 'react'
import { StyleSheet } from 'react-native'

const PlaylistRenderItem: React.FC<{ item: Playlist }> = ({ item }) => (
  <PlaylistListItem playlist={item} showArt={true} size="big" style={styles.listItem} />
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
      getItemLayout={LIST_ITEM_BIG.getItemLayout}
    />
  )
}

const styles = StyleSheet.create({
  listItem: {
    paddingHorizontal: 10,
  },
})

export default PlaylistsList
