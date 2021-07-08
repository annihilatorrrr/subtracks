import { useNavigation } from '@react-navigation/native'
import { useAtomValue } from 'jotai/utils'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Album } from '@app/models/music'
import { albumsAtom, albumsUpdatingAtom, useUpdateAlbums } from '@app/state/music'
import font from '@app/styles/font'
import AlbumArt from '@app/components/AlbumArt'
import GradientFlatList from '@app/components/GradientFlatList'
import colors from '@app/styles/colors'

const AlbumItem: React.FC<{
  id: string
  name: string
  artist?: string
}> = ({ id, name, artist }) => {
  const navigation = useNavigation()

  return (
    <Pressable style={styles.item} onPress={() => navigation.navigate('AlbumView', { id, title: name })}>
      <AlbumArt id={id} height={styles.art.height} width={styles.art.height} />
      <View style={styles.itemDetails}>
        <Text style={styles.title} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {artist}
        </Text>
      </View>
    </Pressable>
  )
}
const MemoAlbumItem = React.memo(AlbumItem)

const AlbumListRenderItem: React.FC<{ item: Album }> = ({ item }) => (
  <MemoAlbumItem id={item.id} name={item.name} artist={item.artist} />
)

const AlbumsList = () => {
  const albums = useAtomValue(albumsAtom)
  const updating = useAtomValue(albumsUpdatingAtom)
  const updateAlbums = useUpdateAlbums()

  const albumsList = Object.values(albums)

  useEffect(() => {
    if (albumsList.length === 0) {
      updateAlbums()
    }
  })

  return (
    <View style={styles.container}>
      <GradientFlatList
        data={albumsList}
        renderItem={AlbumListRenderItem}
        keyExtractor={item => item.id}
        numColumns={3}
        removeClippedSubviews={true}
        refreshing={updating}
        onRefresh={updateAlbums}
        overScrollMode="never"
      />
    </View>
  )
}

const AlbumsTab = () => (
  <React.Suspense fallback={<Text>Loading...</Text>}>
    <AlbumsList />
  </React.Suspense>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    alignItems: 'center',
    marginVertical: 8,
    flex: 1 / 3,
  },
  art: {
    height: 125,
  },
  itemDetails: {
    flex: 1,
    width: 125,
  },
  title: {
    fontSize: 13,
    fontFamily: font.semiBold,
    color: colors.text.primary,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: font.regular,
    color: colors.text.secondary,
  },
})

export default React.memo(AlbumsTab)