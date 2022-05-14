import { CacheImageSize, CacheItemTypeKey } from '@app/models/cache'
import { Album, Playlist, Song, StarrableItemType } from '@app/models/library'
import queryClient from '@app/query/queryClient'
import { useStore } from '@app/state/store'
import { GetAlbumList2TypeBase, Search3Params, StarParams } from '@app/subsonic/params'
import _ from 'lodash'
import { useInfiniteQuery, useMutation, useQueries, useQuery } from 'react-query'
import {
  useFetchAlbum,
  useFetchAlbumList,
  useFetchArtist,
  useFetchArtistInfo,
  useFetchArtists,
  useFetchArtistTopSongs,
  useFetchPlaylist,
  useFetchPlaylists,
  useFetchSearchResults,
  useFetchSong,
  useFetchStar,
  useFetchUnstar,
} from '../query/fetch/api'
import q from '@app/query/queryKeys'
import { useFetchExistingFile, useFetchFile } from '@app/query/fetch/file'
import { useCallback, useState } from 'react'

export const useQueryArtists = () => useQuery(q.artists.key(), useFetchArtists())

export const useQueryArtist = (id: string) => {
  const fetchArtist = useFetchArtist()

  return useQuery(q.artist.key({ id }), () => fetchArtist(id), {
    placeholderData: () => {
      const artist = q.artists.query.get()?.byId[id]
      if (artist) {
        return { artist, albums: [] }
      }
    },
  })
}

export const useQueryArtistInfo = (id: string) => {
  const fetchArtistInfo = useFetchArtistInfo()
  return useQuery(q.artistInfo.key({ id }), () => fetchArtistInfo(id))
}

export const useQueryArtistTopSongs = (artistName?: string) => {
  const fetchArtistTopSongs = useFetchArtistTopSongs()
  const query = useQuery(
    q.artistTopSongs.key({ artistName: artistName || '' }),
    () => fetchArtistTopSongs(artistName!),
    {
      enabled: !!artistName,
      retry: false,
      staleTime: Infinity,
      cacheTime: Infinity,
      notifyOnChangeProps: ['data', 'isError', 'isFetched', 'isSuccess', 'isFetching'],
    },
  )

  const querySuccess = query.isFetched && query.isSuccess && query.data && query.data.length > 0

  const fetchSearchResults = useFetchSearchResults()
  const [artistCount, albumCount, songCount] = [0, 0, 300]
  const backupQuery = useQuery(
    q.search.key({ query: artistName || '', artistCount, albumCount, songCount }),
    () => fetchSearchResults({ query: artistName!, artistCount, albumCount, songCount }),
    {
      select: data => {
        const artistNameLower = artistName?.toLowerCase()
        const songs = data.songs.filter(s => s.artist?.toLowerCase() === artistNameLower)

        // sortBy is a stable sort, so that this doesn't change order arbitrarily and re-render
        return _.sortBy(songs, [
          s => -(s.playCount || 0),
          s => -(s.averageRating || 0),
          s => -(s.userRating || 0),
        ]).slice(0, 50)
      },
      enabled: !!artistName && !query.isFetching && !querySuccess,
      staleTime: Infinity,
      cacheTime: Infinity,
      notifyOnChangeProps: ['data', 'isError'],
    },
  )

  return querySuccess ? query : backupQuery
}

export const useQueryPlaylists = () => useQuery(q.playlists.key(), useFetchPlaylists())

export const useQueryPlaylist = (id: string, placeholderPlaylist?: Playlist) => {
  const fetchPlaylist = useFetchPlaylist()

  const query = useQuery(q.playlist.key({ id }), () => fetchPlaylist(id), {
    placeholderData: () => {
      if (placeholderPlaylist) {
        return { playlist: placeholderPlaylist } as any
      }

      const playlist = q.playlists.query.get()?.byId[id]
      if (playlist) {
        return { playlist, songs: [] }
      }
    },
  })

  return query
}

export const useQueryAlbum = (id: string, placeholderAlbum?: Album) => {
  const fetchAlbum = useFetchAlbum()

  const query = useQuery(q.album.key({ id }), () => fetchAlbum(id), {
    placeholderData: (): { album: Album; songs?: Song[] } | undefined =>
      placeholderAlbum ? { album: placeholderAlbum } : undefined,
  })

  return query
}

export const useQueryAlbumList = (type: GetAlbumList2TypeBase, size: number) => {
  const fetchAlbumList = useFetchAlbumList()

  return useInfiniteQuery(
    q.albumList.key({ type, size }),
    async context => {
      return await fetchAlbumList(size, context.pageParam || 0, type)
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.length === 0) {
          return
        }
        return allPages.length * size
      },
      cacheTime: 0,
    },
  )
}

export const useQuerySearchResults = (params: Search3Params) => {
  const fetchSearchResults = useFetchSearchResults()

  const query = useInfiniteQuery(
    q.search.key(params),
    async context => {
      return await fetchSearchResults({
        ...params,
        artistOffset: context.pageParam?.artistOffset || 0,
        albumOffset: context.pageParam?.albumOffset || 0,
        songOffset: context.pageParam?.songOffset || 0,
      })
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.albums.length + lastPage.artists.length + lastPage.songs.length === 0) {
          return
        }
        return {
          artistOffset: allPages.reduce((acc, val) => (acc += val.artists.length), 0),
          albumOffset: allPages.reduce((acc, val) => (acc += val.albums.length), 0),
          songOffset: allPages.reduce((acc, val) => (acc += val.songs.length), 0),
        }
      },
      cacheTime: 1000 * 60,
      enabled: !!params.query && params.query.length > 1,
    },
  )

  return query
}

export const useQueryHomeLists = (types: GetAlbumList2TypeBase[], size: number) => {
  const fetchAlbumList = useFetchAlbumList()

  const listQueries = useQueries(
    types.map(type => {
      return {
        queryKey: q.albumList.key({ type, size }),
        queryFn: async () => {
          const albums = await fetchAlbumList(size, 0, type as GetAlbumList2TypeBase)
          return { type, albums }
        },
      }
    }),
  )

  return listQueries
}

export const useStar = (id: string, type: StarrableItemType) => {
  const fetchStar = useFetchStar()
  const fetchUnstar = useFetchUnstar()
  const fetchSong = useFetchSong()
  const fetchAlbum = useFetchAlbum()
  const fetchArtist = useFetchArtist()

  const query = useQuery(
    q.starredItems.key({ id }),
    async () => {
      switch (type) {
        case 'album':
          console.log('fetch album starred', id)
          return !!(await fetchAlbum(id)).album.starred
        case 'artist':
          console.log('fetch artist starred', id)
          return !!(await fetchArtist(id)).artist.starred
        default:
          console.log('fetch song starred', id)
          return !!(await fetchSong(id)).starred
      }
    },
    {
      cacheTime: Infinity,
      staleTime: Infinity,
    },
  )

  const toggle = useMutation(
    () => {
      const params: StarParams = {
        id: type === 'song' ? id : undefined,
        albumId: type === 'album' ? id : undefined,
        artistId: type === 'artist' ? id : undefined,
      }
      return !query.data ? fetchStar(params) : fetchUnstar(params)
    },
    {
      onMutate: () => {
        q.starredItems.query({ id }).set(!query.data)
      },
      onSuccess: () => {
        if (type === 'album') {
          queryClient.invalidateQueries(q.albumList.partialKey({ type: 'starred' }))
        }
      },
    },
  )

  return { query, toggle }
}

export const useQueryExistingFile = (itemType: CacheItemTypeKey, itemId: string) => {
  const fetchExistingFile = useFetchExistingFile()

  return useQuery(q.existingFiles.key({ type: itemType, itemId }), () => fetchExistingFile({ itemType, itemId }), {
    staleTime: Infinity,
    cacheTime: Infinity,
    notifyOnChangeProps: ['data', 'isFetched'],
  })
}

export const useQueryCoverArtPath = (coverArt = '-1', size: CacheImageSize = 'thumbnail') => {
  const fetchFile = useFetchFile()
  const client = useStore(store => store.client)

  const itemType: CacheItemTypeKey = size === 'original' ? 'coverArt' : 'coverArtThumb'
  const existing = useQueryExistingFile(itemType, coverArt)

  const query = useQuery(
    q.coverArt.key({ coverArt, size }),
    async () => {
      if (!client) {
        return
      }

      const fromUrl = client.getCoverArtUri({ id: coverArt, size: itemType === 'coverArtThumb' ? '256' : undefined })
      return await fetchFile({ itemType, itemId: coverArt, fromUrl, expectedContentType: 'image' })
    },
    {
      enabled: existing.isFetched && !existing.data && !!client,
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  )

  return { ...query, data: existing.data || query.data, isExistingFetching: existing.isFetching }
}

export const useQueryArtistArtPath = (artistId: string, size: CacheImageSize = 'thumbnail') => {
  const fetchFile = useFetchFile()
  const client = useStore(store => store.client)
  const { data: artistInfo } = useQueryArtistInfo(artistId)

  const itemType: CacheItemTypeKey = size === 'original' ? 'artistArt' : 'artistArtThumb'
  const existing = useQueryExistingFile(itemType, artistId)

  const query = useQuery(
    q.artistArt.key({ artistId, size }),
    async () => {
      if (!client || !artistInfo?.smallImageUrl || !artistInfo?.largeImageUrl) {
        return
      }

      const fromUrl = itemType === 'artistArtThumb' ? artistInfo.smallImageUrl : artistInfo.largeImageUrl
      return await fetchFile({ itemType, itemId: artistId, fromUrl, expectedContentType: 'image' })
    },
    {
      enabled:
        existing.isFetched &&
        !existing.data &&
        !!client &&
        (!!artistInfo?.smallImageUrl || !!artistInfo?.largeImageUrl),
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  )

  return { ...query, data: existing.data || query.data, isExistingFetching: existing.isFetching }
}

export const useQuerySongPath = (id: string) => {
  const fetchFile = useFetchFile()
  const client = useStore(store => store.client)
  const [enableDownload, setEnableDownload] = useState(false)
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const progressFunc = useCallback(
    (rec, tot) => {
      const newProgress = tot > 0 ? rec / tot : 0
      if (progress === undefined || newProgress > progress) {
        console.log('id:', id, 'progress:', newProgress)
        setProgress(newProgress)
      }
    },
    [id, progress],
  )

  const itemType: CacheItemTypeKey = 'song'
  const existing = useQueryExistingFile(itemType, id)

  const query = useQuery(
    q.songPath.key({ id }),
    async () => {
      if (!client) {
        return
      }

      const fromUrl = client.downloadUri({ id })
      return await fetchFile({ itemType, itemId: id, fromUrl, expectedContentType: 'audio', progress: progressFunc })
    },
    {
      enabled: existing.isFetched && !existing.data && !!client && enableDownload,
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  )

  return {
    ...query,
    data: existing.data || query.data,
    isExistingFetching: existing.isFetching,
    setEnableDownload,
    progress,
  }
}

export const useQueryAlbumCoverArtPath = (albumId?: string, size: CacheImageSize = 'thumbnail') => {
  const fetchAlbum = useFetchAlbum()

  const query = useQuery(
    q.albumCoverArt.key({ id: albumId || '-1' }),
    async () => (await fetchAlbum(albumId || '-1')).album.coverArt,
    {
      enabled: !!albumId,
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  )

  return useQueryCoverArtPath(query.data, size)
}
