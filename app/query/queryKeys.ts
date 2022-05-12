import { CacheImageSize, CacheItemTypeKey } from '@app/models/cache'
import { GetAlbumList2TypeBase } from '@app/subsonic/params'
import { RecordOfFunctionsToOpt } from '@app/util/types'

type QueryKeys = {
  starredItems: (id: string) => ['starredItems', string]
  albumCoverArt: (id: string) => ['albumCoverArt', string]

  artists: () => ['artists']
  artist: (id: string) => ['artist', string]
  artistInfo: (id: string) => ['artistInfo', string]
  artistTopSongs: (artistName: string) => ['artistTopSongs', string]

  playlists: () => ['playlists']
  playlist: (id: string) => ['playlist', string]

  album: (id: string) => ['album', string]
  albumList: (type: GetAlbumList2TypeBase, size: number) => ['albumList', GetAlbumList2TypeBase, number]

  song: (id: string) => ['song', string]

  search: (
    query: string,
    artistCount?: number,
    albumCount?: number,
    songCount?: number,
  ) => ['search', string, number | undefined, number | undefined, number | undefined]

  coverArt: (coverArt: string, size: CacheImageSize) => ['coverArt', string, CacheImageSize]
  artistArt: (artistId: string, size: CacheImageSize) => ['artistArt', string, CacheImageSize]
  songPath: (id: string) => ['songPath', string]
  existingFiles: (type: CacheItemTypeKey, itemId: string) => ['existingFiles', CacheItemTypeKey, string]
}

type QueryKeyFilters = RecordOfFunctionsToOpt<QueryKeys, any[]>

const qk: QueryKeys = {
  starredItems: id => ['starredItems', id],
  albumCoverArt: id => ['albumCoverArt', id],

  artists: () => ['artists'],
  artist: id => ['artist', id],
  artistInfo: id => ['artistInfo', id],
  artistTopSongs: artistName => ['artistTopSongs', artistName],

  playlists: () => ['playlists'],
  playlist: id => ['playlist', id],

  album: id => ['album', id],
  albumList: (type, size) => ['albumList', type, size],

  song: id => ['song', id],

  search: (query, artistCount, albumCount, songCount) => ['search', query, artistCount, albumCount, songCount],

  coverArt: (coverArt, size) => ['coverArt', coverArt, size],
  artistArt: (artistId, size) => ['artistArt', artistId, size],
  songPath: id => ['songPath', id],
  existingFiles: (type, itemId) => ['existingFiles', type, itemId],
}

export const qkFilters: QueryKeyFilters = {
  starredItems: id => {
    const key: any[] = ['starredItems']
    id !== undefined && key.push(id)
    return key
  },
  albumCoverArt: id => {
    const key: any[] = ['albumCoverArt']
    id !== undefined && key.push(id)
    return key
  },

  artists: () => ['artists'],
  artist: id => {
    const key: any[] = ['artist']
    id !== undefined && key.push(id)
    return key
  },
  artistInfo: id => {
    const key: any[] = ['artistInfo']
    id !== undefined && key.push(id)
    return key
  },
  artistTopSongs: artistName => {
    const key: any[] = ['artistTopSongs']
    artistName !== undefined && key.push(artistName)
    return key
  },

  playlists: () => ['playlists'],
  playlist: id => {
    const key: any[] = ['playlist']
    id !== undefined && key.push(id)
    return key
  },

  album: id => {
    const key: any[] = ['album']
    id !== undefined && key.push(id)
    return key
  },
  albumList: (type, size) => {
    const key: any[] = ['albumList']
    type !== undefined && key.push(type)
    size !== undefined && key.push(size)
    return key
  },

  song: id => {
    const key: any[] = ['song']
    id !== undefined && key.push(id)
    return key
  },

  search: (query, artistCount, albumCount, songCount) => {
    const key: any[] = ['search']
    query !== undefined && key.push(query)
    artistCount !== undefined && key.push(artistCount)
    albumCount !== undefined && key.push(albumCount)
    songCount !== undefined && key.push(songCount)
    return key
  },

  coverArt: (coverArt, size) => {
    const key: any[] = ['coverArt']
    coverArt !== undefined && key.push(coverArt)
    size !== undefined && key.push(size)
    return key
  },
  artistArt: (artistId, size) => {
    const key: any[] = ['artistArt']
    artistId !== undefined && key.push(artistId)
    size !== undefined && key.push(size)
    return key
  },
  songPath: id => {
    const key: any[] = ['songPath']
    id !== undefined && key.push(id)
    return key
  },
  existingFiles: (type, itemId) => {
    const key: any[] = ['existingFiles']
    type !== undefined && key.push(type)
    itemId !== undefined && key.push(itemId)
    return key
  },
}

export default qk
