import {
  Album,
  AlbumSongs,
  Artist,
  ArtistAlbums,
  ArtistInfo,
  Playlist,
  PlaylistSongs,
  SearchResults,
  Song,
} from '@app/models/library'
import { CollectionById } from '@app/models/state'
import client from './queryClient'
import qk from './queryKeys'

type GetSet<K, V> = {
  get(key: K): V | undefined
  set(key: K, value: V): void
}

export type QueryCache = GetSet<ReturnType<typeof qk['starredItems']>, boolean> &
  GetSet<ReturnType<typeof qk['albumCoverArt']>, string | undefined> &
  GetSet<ReturnType<typeof qk['artists']>, CollectionById<Artist>> &
  GetSet<ReturnType<typeof qk['artist']>, ArtistAlbums> &
  GetSet<ReturnType<typeof qk['artistInfo']>, ArtistInfo> &
  GetSet<ReturnType<typeof qk['artistTopSongs']>, Song[]> &
  GetSet<ReturnType<typeof qk['playlists']>, CollectionById<Playlist>> &
  GetSet<ReturnType<typeof qk['playlist']>, PlaylistSongs> &
  GetSet<ReturnType<typeof qk['album']>, AlbumSongs> &
  GetSet<ReturnType<typeof qk['albumList']>, Album[]> &
  GetSet<ReturnType<typeof qk['song']>, Song> &
  GetSet<ReturnType<typeof qk['search']>, SearchResults> &
  GetSet<ReturnType<typeof qk['coverArt']>, string> &
  GetSet<ReturnType<typeof qk['artistArt']>, string> &
  GetSet<ReturnType<typeof qk['existingFiles']>, string | undefined> &
  GetSet<ReturnType<typeof qk['songPath']>, string>

const queryCache: QueryCache = {
  get: key => client.getQueryData(key),
  set: (key, value) => client.setQueryData(key, value),
}

export default queryCache
