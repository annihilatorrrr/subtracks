import GradientFlatList from '@app/components/GradientFlatList'
import { AlbumListItem, ArtistListItem, SongListItem } from '@app/components/ListItem'
import { withSuspense } from '@app/components/withSuspense'
import { useQuerySearchResults } from '@app/hooks/query'
import { useSetQueue } from '@app/hooks/trackplayer'
import { Album, Artist, Song } from '@app/models/library'
import { listItemDefaultLayout } from '@app/styles/dimensions'
import { Search3Params } from '@app/subsonic/params'
import { useNavigation } from '@react-navigation/native'
import equal from 'fast-deep-equal/es6/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'

type SearchListItemType = Album | Song | Artist

const SongResultsListItem = React.memo<{ item: Song }>(({ item }) => {
  const { setQueue, contextId } = useSetQueue('song', [item])

  return (
    <SongListItem
      song={item}
      contextId={contextId}
      queueId={0}
      showArt={true}
      showStar={false}
      onPress={() => setQueue({ title: item.title, playTrack: 0 })}
      style={styles.listItem}
      subtitle="artist-album"
    />
  )
}, equal)

const ResultsListItem: React.FC<{ item: SearchListItemType }> = ({ item }) => {
  switch (item.itemType) {
    case 'song':
      return <SongResultsListItem item={item} />
    case 'album':
      return <AlbumListItem album={item} showArt={true} showStar={false} style={styles.listItem} />
    default:
      return <ArtistListItem artist={item} showArt={true} showStar={false} style={styles.listItem} />
  }
}

const SearchResultsRenderItem: React.FC<{ item: SearchListItemType }> = ({ item }) => <ResultsListItem item={item} />

const SearchResultsView = withSuspense<{
  query: string
  type: 'album' | 'artist' | 'song'
}>(({ query, type }) => {
  const navigation = useNavigation()
  const { t } = useTranslation()

  const size = 100
  const params: Search3Params = { query }

  if (type === 'album') {
    params.albumCount = size
  } else if (type === 'artist') {
    params.artistCount = size
  } else {
    params.songCount = size
  }

  const { data, isLoading, refetch, fetchNextPage } = useQuerySearchResults(params)

  const items: (Artist | Album | Song)[] = []
  if (type === 'album') {
    data && items.push(...data.pages.flatMap(p => p.albums))
  } else if (type === 'artist') {
    data && items.push(...data.pages.flatMap(p => p.artists))
  } else {
    data && items.push(...data.pages.flatMap(p => p.songs))
  }

  useEffect(() => {
    navigation.setOptions({
      title: t('search.headerTitle', { query }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <GradientFlatList
      data={items}
      renderItem={SearchResultsRenderItem}
      keyExtractor={(item, i) => i.toString()}
      onRefresh={refetch}
      refreshing={isLoading}
      overScrollMode="never"
      onEndReached={() => fetchNextPage}
      removeClippedSubviews={true}
      onEndReachedThreshold={2}
      contentMarginTop={6}
      windowSize={5}
      getItemLayout={listItemDefaultLayout}
    />
  )
})

const styles = StyleSheet.create({
  listItem: {
    paddingHorizontal: 10,
  },
})

export default SearchResultsView
