import { CacheImageSize } from '@app/models/cache'
import { AlbumSongs, ArtistAlbums, ArtistInfo, PlaylistSongs, Song } from '@app/models/library'
import { ById, OrderedById } from '@app/models/state'
import { fetchAlbum, fetchArtist, fetchArtistInfo, fetchPlaylist, fetchSong } from '@app/query/fetch/api'
import { fetchExistingFile, fetchFile, FetchFileOptions } from '@app/query/fetch/file'
import q from '@app/query/queryKeys'
import { SubsonicApiClient } from '@app/subsonic/api'
import PromiseQueue from '@app/util/PromiseQueue'
import { GetStore, SetStore } from './store'

let downloadQueue: PromiseQueue

export type DownloadJob = {
  id: string
  songId: string
  serverId: string
  playlistId?: string
  song?: Song
  album?: AlbumSongs
  artist?: ArtistAlbums
  artistInfo?: ArtistInfo
  playlist?: PlaylistSongs
  received?: number
  total?: number
}

export type DownloadedSong = Song & {
  path: string
}

export type DownloadCache = {
  songs: ById<DownloadedSong>
  albums: ById<AlbumSongs>
  artists: ById<ArtistAlbums>
  artistsInfo: ById<ArtistInfo>
  playlists: ById<PlaylistSongs>
}

export type DownloadJobOptions = {
  songId: string
  serverId: string
}

export type DownloadSlice = {
  downloads: ById<DownloadCache>
  downloadQueue: OrderedById<DownloadJob>

  initDownloads: () => void
  downloadSong: (id: string, playlistId?: string) => DownloadJob | undefined

  _enqueueJob: (id: string) => Promise<void>
  _downloadJob: (id: string) => Promise<void>

  _fetchSong: (id: string, serverId: string, client: SubsonicApiClient) => Promise<Song>
  _fetchPlaylist: (id: string, serverId: string, client: SubsonicApiClient) => Promise<PlaylistSongs>
  _fetchAlbum: (id: string, serverId: string, client: SubsonicApiClient) => Promise<AlbumSongs>
  _fetchArtist: (id: string, serverId: string, client: SubsonicApiClient) => Promise<ArtistAlbums>
  _fetchArtistInfo: (id: string, serverId: string, client: SubsonicApiClient) => Promise<ArtistInfo>
  _cacheCoverArt: (coverArt: string, size: CacheImageSize, serverId: string, client: SubsonicApiClient) => Promise<void>
  _cacheArtistArt: (artistId: string, size: CacheImageSize, fromUrl: string, serverId: string) => Promise<void>

  _getDownloadCache: (serverId?: string) => { downloads: DownloadCache; serverId: string } | undefined
}

export const createDownloadSlice = (set: SetStore, get: GetStore): DownloadSlice => ({
  downloads: {},
  downloadQueue: { byId: {}, allIds: [] },

  initDownloads: () => {
    if (downloadQueue) {
      return
    }

    downloadQueue = new PromiseQueue(1)

    for (const id of get().downloadQueue.allIds) {
      get()._enqueueJob(id)
    }
  },

  downloadSong: (songId, playlistId) => {
    const downloadCache = get()._getDownloadCache()
    if (!downloadCache) {
      return
    }

    const { downloads, serverId } = downloadCache
    const id = downloadId({ songId, serverId })

    if (songId in downloads.songs || id in get().downloadQueue.byId) {
      return
    }

    const job: DownloadJob = { id, songId, serverId, playlistId }
    set(state => {
      state.downloadQueue.byId[job.id] = job
      state.downloadQueue.allIds.push(job.id)
    })

    get()._enqueueJob(id)

    return job
  },

  _enqueueJob: async (id: string) => {
    return downloadQueue.enqueue(() =>
      get()
        ._downloadJob(id)
        .catch(err => {
          console.warn(err)
        })
        .finally(() => {
          set(state => {
            delete state.downloadQueue.byId[id]
            state.downloadQueue.allIds.shift()
          })
        }),
    )
  },

  _downloadJob: async id => {
    const job = get().downloadQueue.byId[id]
    if (!job) {
      return
    }

    const { songId, serverId } = job

    const downloadCache = get()._getDownloadCache(serverId)
    if (!downloadCache) {
      return
    }

    const server = get().settings.servers[serverId]
    if (!server) {
      return
    }

    const client = new SubsonicApiClient(server)

    // fetch song (and optionally playlist)
    const [song, playlist] = await Promise.all([
      get()._fetchSong(songId, serverId, client),
      job.playlistId ? get()._fetchPlaylist(job.playlistId, serverId, client) : Promise.resolve(undefined),
    ])

    job.song = song
    job.playlist = playlist
    set(state => {
      state.downloadQueue.byId[id] = { ...job }
    })

    if (!song.albumId) {
      throw new Error('song missing albumId')
    }

    // fetch album & artist & artistInfo
    const [album, artist, artistInfo] = await Promise.all([
      get()._fetchAlbum(song.albumId, serverId, client),
      song.artistId ? get()._fetchArtist(song.artistId, serverId, client) : Promise.resolve(undefined),
      song.artistId ? get()._fetchArtistInfo(song.artistId, serverId, client) : Promise.resolve(undefined),
    ])

    job.album = album
    job.artist = artist
    job.artistInfo = artistInfo
    set(state => {
      state.downloadQueue.byId[id] = { ...job }
    })

    // make sure all art downloaded
    const coverArt = album.album.coverArt || '-1'
    const artistSmallUrl = artistInfo?.smallImageUrl
    const artistLargeUrl = artistInfo?.largeImageUrl
    await Promise.all([
      get()._cacheCoverArt(coverArt, 'thumbnail', serverId, client),
      get()._cacheCoverArt(coverArt, 'original', serverId, client),
      artist && artistSmallUrl
        ? get()._cacheArtistArt(artist.artist.id, 'thumbnail', artistSmallUrl, serverId)
        : Promise.resolve(undefined),
      artist && artistLargeUrl
        ? get()._cacheArtistArt(artist.artist.id, 'original', artistLargeUrl, serverId)
        : Promise.resolve(undefined),
    ])

    // download song file
    const path = await fetchFile(
      {
        itemType: 'song',
        itemId: songId,
        fromUrl: client.downloadUri({ id: songId }),
        useCacheBuster: false,
        expectedContentType: 'audio',
        progress: (received, total) => {
          set(state => {
            state.downloadQueue.byId[id].received = received
            state.downloadQueue.byId[id].total = total
          })
        },
      },
      serverId,
    )

    // save path
    set(state => {
      state.downloads[serverId].songs[songId] = { ...song, path }
      state.downloads[serverId].albums[album.album.id] = album

      if (artist) {
        state.downloads[serverId].artists[artist.artist.id] = artist
      }

      if (artistInfo) {
        state.downloads[serverId].artistsInfo[artistInfo.id] = artistInfo
      }

      if (playlist) {
        state.downloads[serverId].playlists[playlist.playlist.id] = playlist
      }
    })
  },

  _fetchSong: async (id, serverId, client) => {
    const downloaded = get().downloads[serverId].songs[id]
    if (downloaded) {
      return downloaded
    }

    return await fetchSong(id, client)
  },

  _fetchPlaylist: async (id, serverId, client) => {
    const downloaded = get().downloads[serverId].playlists[id]
    if (downloaded) {
      return downloaded
    }

    const cachedById = q.playlist.query({ id }).get()
    if (cachedById) {
      return cachedById
    }

    return await fetchPlaylist(id, client)
  },

  _fetchAlbum: async (id, serverId, client) => {
    const downloaded = get().downloads[serverId].albums[id]
    if (downloaded) {
      return downloaded
    }

    const cachedById = q.album.query({ id }).get()
    if (cachedById) {
      return cachedById
    }

    return await fetchAlbum(id, client)
  },

  _fetchArtist: async (id, serverId, client) => {
    const downloaded = get().downloads[serverId].artists[id]
    if (downloaded) {
      return downloaded
    }

    const cachedById = q.artist.query({ id }).get()
    if (cachedById) {
      return cachedById
    }

    return await fetchArtist(id, client)
  },

  _fetchArtistInfo: async (id, serverId, client) => {
    const downloaded = get().downloads[serverId].artistsInfo[id]
    if (downloaded) {
      return downloaded
    }

    const cachedById = q.artistInfo.query({ id }).get()
    if (cachedById) {
      return cachedById
    }

    return await fetchArtistInfo(id, client)
  },

  _cacheCoverArt: async (coverArt, size, serverId, client) => {
    const options: FetchFileOptions = {
      itemType: size === 'thumbnail' ? 'coverArtThumb' : 'coverArt',
      itemId: coverArt,
      fromUrl: client.getCoverArtUri({ id: coverArt, size }),
      expectedContentType: 'image',
    }

    try {
      const existing = await fetchExistingFile(options, serverId)
      if (!existing) {
        await fetchFile(options, serverId)
      }
    } catch {}
  },

  _cacheArtistArt: async (artistId, size, fromUrl, serverId) => {
    const options: FetchFileOptions = {
      itemType: size === 'thumbnail' ? 'artistArtThumb' : 'artistArt',
      itemId: artistId,
      fromUrl,
      expectedContentType: 'image',
    }

    try {
      const existing = await fetchExistingFile(options, serverId)
      if (!existing) {
        await fetchFile(options, serverId)
      }
    } catch {}
  },

  _getDownloadCache: serverId => {
    serverId = serverId || get().settings.activeServerId
    if (!serverId) {
      return
    }

    let downloads = get().downloads[serverId]
    if (!downloads) {
      downloads = createDownloadCache()
      set(state => {
        state.downloads[serverId!] = downloads
      })
    }

    return { downloads, serverId }
  },
})

export function downloadId(opt: DownloadJobOptions): string {
  return opt.songId + opt.serverId
}

function createDownloadCache(): DownloadCache {
  return {
    songs: {},
    albums: {},
    artists: {},
    artistsInfo: {},
    playlists: {},
  }
}
