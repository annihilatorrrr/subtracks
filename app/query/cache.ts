import { CacheImageSize, CacheItemTypeKey } from '@app/models/cache'
import { AlbumSongs, Artist, ArtistAlbums, ArtistInfo, Playlist, PlaylistSongs, Song } from '@app/models/library'
import { CollectionById } from '@app/models/state'
import { GetAlbumList2TypeBase } from '@app/subsonic/params'
import { QueryKey } from 'react-query'
import downloadCache from './downloadCache'
import client from './queryClient'

type KeyFactorySimple<K extends string> = () => K
type KeyFactory<K extends string, KP extends object> = (params: KP) => [K, KP]
type KeyFilterFactory<K extends string, KP extends object> = (params?: Partial<KP>) => [K] | [K, Partial<KP>]

abstract class BaseCacheItem<V> {
  protected abstract generateKey(): QueryKey

  getQueryData(): V | undefined {
    return client.getQueryData(this.generateKey())
  }

  getDownloadCache(serverId: string): V | undefined {
    return downloadCache(serverId).get(this.generateKey())
  }

  setQueryData(value: V): void {
    client.setQueryData(this.generateKey(), value)
  }

  setDownloadCache(value: V, serverId: string): void {
    downloadCache(serverId).set(this.generateKey(), value)
  }
}

abstract class CacheItemSimple<KI extends string, V> extends BaseCacheItem<V> {
  protected abstract key: KeyFactorySimple<KI>

  protected generateKey() {
    return this.key()
  }
}

abstract class CacheItem<KI extends string, KP extends object, V> extends BaseCacheItem<V> {
  private params: KP

  protected abstract key: KeyFactory<KI, KP>

  protected generateKey() {
    return this.key(this.params)
  }

  constructor(params: KP) {
    super()
    this.params = params
  }
}

function createSimple<KI extends string, V>(keyId: KI, value: V) {
  const ItemKey: KeyFactorySimple<KI> = () => keyId
  class Item extends CacheItemSimple<typeof keyId, typeof value> {
    protected key = ItemKey
  }
  return { ItemKey, Item: () => new Item() }
}

function create<KI extends string, KP extends object, V>(keyId: KI, keyProps: KP, value: V) {
  const ItemKey: KeyFactory<KI, KP> = (params: KP) => [keyId, params]
  const FilterKey: KeyFilterFactory<KI, KP> = params => (params ? [keyId, params] : [keyId])
  class Item extends CacheItem<typeof keyId, typeof keyProps, typeof value> {
    protected key = ItemKey
  }
  return { ItemKey, FilterKey, Item: (params: KP) => new Item(params) }
}

export const {
  ItemKey: StarredItemsKey,
  FilterKey: StarredItemsFilterKey,
  Item: StarredItemsCache,
} = create('starredItems', { id: '' }, true)
export const {
  ItemKey: AlbumCoverArtKey,
  FilterKey: AlbumCoverArtFilterKey,
  Item: AlbumCoverArtCache,
} = create('albumCoverArt', { id: '' }, '' as string | undefined)

export const { ItemKey: ArtistsKey, Item: ArtistsCache } = createSimple('artists', {} as CollectionById<Artist>)
export const {
  ItemKey: ArtistKey,
  FilterKey: ArtistFilterKey,
  Item: ArtistCache,
} = create('artist', { id: '' }, {} as ArtistAlbums)
export const {
  ItemKey: ArtistInfoKey,
  FilterKey: ArtistFilterInfoKey,
  Item: ArtistInfoCache,
} = create('artistInfo', { id: '' }, {} as ArtistInfo)
export const {
  ItemKey: ArtistTopSongsKey,
  FilterKey: ArtistTopSongsFilterKey,
  Item: ArtistTopSongsCache,
} = create('artistTopSongs', { artistName: '' }, [] as Song[])

export const { ItemKey: PlaylistsKey, Item: PlaylistsCache } = createSimple('playlists', {} as CollectionById<Playlist>)
export const {
  ItemKey: PlaylistKey,
  FilterKey: PlaylistFilterKey,
  Item: PlaylistCache,
} = create('playlist', { id: '' }, {} as PlaylistSongs)

export const {
  ItemKey: AlbumKey,
  FilterKey: AlbumFilterKey,
  Item: AlbumCache,
} = create('album', { id: '' }, {} as AlbumSongs)
export const AlbumListKey: KeyFactory<'albumList', { type: GetAlbumList2TypeBase; size: number }> = params => [
  'albumList',
  params,
]
export const AlbumListFilterKey: KeyFilterFactory<
  'albumList',
  { type: GetAlbumList2TypeBase; size: number }
> = params => (params ? ['albumList', params] : ['albumList'])

export const { ItemKey: SongKey, FilterKey: SongFilterKey, Item: SongCache } = create('song', { id: '' }, {} as Song)

export const SearchKey: KeyFactory<
  'search',
  { query: string; artistCount?: number; albumCount?: number; songCount?: number }
> = params => ['search', params]

export const {
  ItemKey: CoverArtKey,
  FilterKey: CoverArtFilterKey,
  Item: CoverArtCache,
} = create('coverArt', { coverArt: '', size: '' as CacheImageSize }, '')
export const {
  ItemKey: ArtistArtKey,
  FilterKey: ArtistArtFilterKey,
  Item: ArtistArtCache,
} = create('artistArt', { artistId: '', size: '' as CacheImageSize }, '')
export const {
  ItemKey: ExistingFilesKey,
  FilterKey: ExistingFilesFilterKey,
  Item: ExistingFilesCache,
} = create('existingFiles', { type: '' as CacheItemTypeKey, itemId: '' }, '' as string | undefined)
export const {
  ItemKey: SongPathKey,
  FilterKey: SongPathFilterKey,
  Item: SongPathCache,
} = create('songPath', { id: '' }, '')
