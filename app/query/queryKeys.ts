import { CacheImageSize, CacheItemTypeKey } from '@app/models/cache'
import { AlbumSongs, Artist, ArtistAlbums, ArtistInfo, Playlist, PlaylistSongs, Song } from '@app/models/library'
import { CollectionById } from '@app/models/state'
import { GetAlbumList2TypeBase } from '@app/subsonic/params'
import { QueryKey } from 'react-query'
import queryClient from './queryClient'

type KeyFactorySimple<KI extends string> = () => KI
type KeyFactory<KI extends string, KP extends object> = (params: KP) => [KI, KP]
type KeyPartialFactory<KI extends string, KP extends object> = (params?: Partial<KP>) => [KI, Partial<KP>] | [KI]

function buildQueries<V>(keyFactory: () => QueryKey) {
  return {
    get: () => queryClient.getQueryData<V>(keyFactory()),
    set: (value: V) => queryClient.setQueryData<V>(keyFactory(), value),
  }
}

function create<KI extends string>(keyId: KI) {
  return <KP extends object, V>() => {
    const key: KeyFactory<KI, KP> = (props: KP) => [keyId, props]
    const partialKey: KeyPartialFactory<KI, KP> = (props?: Partial<KP>) => (props ? [keyId, props] : [keyId])
    const query = (props: KP) => buildQueries<V>(() => key(props))

    return { query, key, partialKey }
  }
}

function createSimple<KI extends string>(keyId: KI) {
  return <V>() => {
    const key: KeyFactorySimple<KI> = () => keyId
    const query = buildQueries<V>(() => key())

    return { query, key }
  }
}

export const q = {
  starredItems: create('starredItems')<{ id: string }, boolean>(),
  albumCoverArt: create('albumCoverArt')<{ id: string }, string | undefined>(),

  artists: createSimple('artists')<CollectionById<Artist>>(),
  artist: create('artist')<{ id: string }, ArtistAlbums>(),
  artistInfo: create('artistInfo')<{ id: string }, ArtistInfo>(),
  artistTopSongs: create('artistTopSongs')<{ artistName: string }, Song[]>(),

  playlists: createSimple('playlists')<CollectionById<Playlist>>(),
  playlist: create('playlist')<{ id: string }, PlaylistSongs>(),

  album: create('album')<{ id: string }, AlbumSongs>(),
  albumList: create('albumList')<{ type: GetAlbumList2TypeBase; size?: number }, unknown>(),

  search: create('search')<{ query: string; artistCount?: number; albumCount?: number; songCount?: number }, unknown>(),

  coverArt: create('coverArt')<{ coverArt: string; size: CacheImageSize }, string>(),
  artistArt: create('artistArt')<{ artistId: string; size: CacheImageSize }, string>(),
  songPath: create('songPath')<{ id: string }, string>(),
  existingFiles: create('existingFiles')<{ type: CacheItemTypeKey; itemId: string }, string | undefined>(),
}

export default q
