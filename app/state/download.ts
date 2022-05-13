import { CacheImageSize } from '@app/models/cache'
import { AlbumSongs, ArtistAlbums, ArtistInfo, PlaylistSongs, Song } from '@app/models/library'
import { ById, OrderedById } from '@app/models/state'
import { AlbumCache, ArtistCache, ArtistInfoCache, PlaylistCache, SongCache, SongPathCache } from '@app/query/cache'
import { fetchAlbum, fetchArtist, fetchArtistInfo, fetchPlaylist, fetchSong } from '@app/query/fetch/api'
import { fetchExistingFile, fetchFile, FetchFileOptions } from '@app/query/fetch/file'
import { SubsonicApiClient } from '@app/subsonic/api'
import PromiseQueue from '@app/util/PromiseQueue'
import { GetStore, SetStore } from './store'

const downloadQueue = new PromiseQueue(1)

export type DownloadJob = {
  id: string
  playlistId?: string
  song?: Song
  album?: AlbumSongs
  artist?: ArtistAlbums
  artistInfo?: ArtistInfo
  playlist?: PlaylistSongs
  received?: number
  total?: number
}

export type DownloadQueue = OrderedById<DownloadJob>

export type DownloadSlice = {
  downloads: ById<DownloadQueue>

  downloadSong: (id: string, playlistId?: string) => DownloadJob | undefined
  _downloadSong: (id: string, serverId: string) => Promise<void>

  _fetchSong: (id: string, serverId: string, client: SubsonicApiClient) => Promise<Song>
  _fetchPlaylist: (id: string, serverId: string, client: SubsonicApiClient) => Promise<PlaylistSongs>
  _fetchAlbum: (id: string, serverId: string, client: SubsonicApiClient) => Promise<AlbumSongs>
  _fetchArtist: (id: string, serverId: string, client: SubsonicApiClient) => Promise<ArtistAlbums>
  _fetchArtistInfo: (id: string, serverId: string, client: SubsonicApiClient) => Promise<ArtistInfo>
  _cacheCoverArt: (coverArt: string, size: CacheImageSize, serverId: string, client: SubsonicApiClient) => Promise<void>
  _cacheArtistArt: (artistId: string, size: CacheImageSize, fromUrl: string, serverId: string) => Promise<void>

  _getDownloadQueue: (serverId?: string) => { queue: DownloadQueue; serverId: string } | undefined
}

export const createDownloadSlice = (set: SetStore, get: GetStore): DownloadSlice => ({
  downloads: {},

  downloadSong: (id, playlistId) => {
    const downloads = get()._getDownloadQueue()
    if (!downloads) {
      return
    }

    const { queue, serverId } = downloads

    if (SongPathCache({ id }).getDownloadCache(serverId) || id in queue.byId) {
      return
    }

    const job: DownloadJob = { id, playlistId }
    set(state => {
      state.downloads[serverId].byId[job.id] = job
      state.downloads[serverId].allIds.push(job.id)
    })

    downloadQueue.enqueue(() =>
      get()
        ._downloadSong(id, serverId)
        .catch(err => {
          console.warn(err)
        })
        .finally(() => {
          set(state => {
            delete state.downloads[serverId].byId[id]
            state.downloads[serverId].allIds.shift()
          })
        }),
    )

    return job
  },

  _downloadSong: async (id, serverId) => {
    const downloads = get()._getDownloadQueue(serverId)
    if (!downloads) {
      return
    }

    const job = downloads.queue.byId[id]
    if (!job) {
      return
    }

    const server = get().settings.servers[serverId]
    if (!server) {
      return
    }

    const client = new SubsonicApiClient(server)

    // fetch song (and optionally playlist)
    const [song, playlist] = await Promise.all([
      get()._fetchSong(id, serverId, client),
      job.playlistId ? get()._fetchPlaylist(job.playlistId, serverId, client) : Promise.resolve(undefined),
    ])

    job.song = song
    job.playlist = playlist
    set(state => {
      state.downloads[serverId].byId[id] = { ...job }
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
      state.downloads[serverId].byId[id] = { ...job }
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
        itemId: id,
        fromUrl: client.downloadUri({ id }),
        useCacheBuster: false,
        expectedContentType: 'audio',
        progress: (received, total) => {
          set(state => {
            state.downloads[serverId].byId[id].received = received
            state.downloads[serverId].byId[id].total = total
          })
        },
      },
      serverId,
    )

    // save data
    SongCache({ id }).setDownloadCache(song, serverId)
    SongPathCache({ id }).setDownloadCache(path, serverId)
    AlbumCache({ id: album.album.id }).setDownloadCache(album, serverId)
    if (artist) {
      ArtistCache({ id: artist.artist.id }).setDownloadCache(artist, serverId)
    }
    if (artistInfo) {
      ArtistInfoCache({ id: artistInfo.id }).setDownloadCache(artistInfo, serverId)
    }
    if (playlist) {
      PlaylistCache({ id: playlist.playlist.id }).setDownloadCache(playlist, serverId)
    }
  },

  _fetchSong: async (id, serverId, client) => {
    const downloaded = SongCache({ id }).getDownloadCache(serverId)
    if (downloaded) {
      return downloaded
    }

    return await fetchSong(id, client)
  },

  _fetchPlaylist: async (id, serverId, client) => {
    const cache = PlaylistCache({ id })
    const downloaded = cache.getDownloadCache(serverId)
    if (downloaded) {
      return downloaded
    }

    const cachedById = cache.getQueryData()
    if (cachedById) {
      return cachedById
    }

    return await fetchPlaylist(id, client)
  },

  _fetchAlbum: async (id, serverId, client) => {
    const cache = AlbumCache({ id })
    const downloaded = cache.getDownloadCache(serverId)
    if (downloaded) {
      return downloaded
    }

    const cachedById = cache.getQueryData()
    if (cachedById) {
      return cachedById
    }

    return await fetchAlbum(id, client)
  },

  _fetchArtist: async (id, serverId, client) => {
    const cache = ArtistCache({ id })
    const downloaded = cache.getDownloadCache(serverId)
    if (downloaded) {
      return downloaded
    }

    const cachedById = cache.getQueryData()
    if (cachedById) {
      return cachedById
    }

    return await fetchArtist(id, client)
  },

  _fetchArtistInfo: async (id, serverId, client) => {
    const cache = ArtistInfoCache({ id })
    const downloaded = cache.getDownloadCache(serverId)
    if (downloaded) {
      return downloaded
    }

    const cachedById = cache.getQueryData()
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

  _getDownloadQueue: serverId => {
    serverId = serverId || get().settings.activeServerId
    if (!serverId) {
      return
    }

    let queue = get().downloads[serverId]
    if (!queue) {
      queue = { byId: {}, allIds: [] }
      set(state => {
        state.downloads[serverId!] = queue
      })
    }

    return { queue, serverId }
  },
})
