import { NoClientError } from '@app/models/error'
import { Album, Song } from '@app/models/library'
import { Progress, QueueType, TrackExt } from '@app/models/trackplayer'
import { fetchAlbum } from '@app/query/fetch/api'
import { FetchExisingFileOptions, fetchExistingFile, fetchFile, FetchFileOptions } from '@app/query/fetch/file'
import queryClient from '@app/query/queryClient'
import qk from '@app/query/queryKeys'
import { SubsonicApiClient } from '@app/subsonic/api'
import QueueEvents from '@app/trackplayer/QueueEvents'
import PromiseQueue from '@app/util/PromiseQueue'
import userAgent from '@app/util/userAgent'
import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo'
import _ from 'lodash'
import TrackPlayer, { PlayerOptions, RepeatMode, State } from 'react-native-track-player'
import { GetStore, SetStore } from './store'

export type SetQueueOptions = {
  title: string
  playTrack?: number
  shuffle?: boolean
}

export type SetQueueOptionsInternal = SetQueueOptions & {
  queue: TrackExt[]
  contextId: string
  type: QueueType
}

export type Session = {
  queue: Song[]
  title: string
  type: QueueType
  current: Song
  currentIdx: number
  progress: Progress
  holdProgress: boolean
  contextId: string
  shuffleOrder?: number[]
  playerState: State
  duckPaused: boolean
}

export type CreateSessionOptions = {
  queue: Song[]
  title: string
  type: QueueType
  contextId: string
  playIdx?: number
  shuffle?: boolean
}

export type TrackPlayerSlice = {
  session?: Session
  repeatMode: RepeatMode
  netState: 'mobile' | 'wifi'

  _lockQueue: boolean

  createSession: (options: CreateSessionOptions) => Promise<void>

  onSessionCreated: () => Promise<void>

  onPlaybackTrackChanged: (nextTrack?: number, track?: number) => Promise<void>
  onPlaybackState: (state: State) => void
  onPlaybackError: (code: string, message: string) => Promise<void>
  onRemoteDuck: (paused: boolean, permanent: boolean) => Promise<void>

  onNetInfo: (netState: NetInfoState) => Promise<void>
  onSongChanged: (id?: string) => Promise<void>

  play: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  skip: (track: number) => Promise<void>
  seek: (position: number) => Promise<void>
  _seek: (position: number) => Promise<void>
  toggleRepeatMode: () => Promise<void>
  toggleShuffle: () => Promise<void>
  destroy: () => Promise<void>

  setProgress: (progress: Progress) => void
  releaseProgressHold: () => void

  _syncQueue: (rebuild?: boolean) => Promise<void>
  _resetQueue: (playerState: State, position?: number) => Promise<void>
  _getPlayerOptions: () => PlayerOptions
  _buildStreamUri: (id: string) => string
  _mapSongs: (songs: { song: Song; idx: number }[]) => Promise<TrackExt[]>

  _cacheCoverArtPaths: (
    songs: Song[],
    fetchMessing?: boolean,
    throwOnQueueChange?: boolean,
  ) => Promise<{ [albumId: string]: string | undefined }>
  _fetchQueueArtwork: () => Promise<void>
  _getClient: () => SubsonicApiClient
  _getAlbum: (id: string) => Promise<{ album: Album; songs?: Song[] } | undefined>
  _getCoverArtThumb: (coverArt: string) => Promise<string | undefined>
  _getCoverArtThumbExisting: (coverArt: string) => Promise<string | undefined>
}

export const createTrackPlayerSlice = (set: SetStore, get: GetStore): TrackPlayerSlice => ({
  repeatMode: RepeatMode.Off,
  netState: 'mobile',

  _lockQueue: false,

  createSession: async ({ queue, type, title, contextId, playIdx, shuffle }) => {
    if (queue.length === 0) {
      return rntpCommands.enqueue(async () => {
        set(state => {
          state.session = undefined
        })
        try {
          await TrackPlayer.destroy()
        } catch {}
      })
    }

    await rntpCommands.enqueue(async () => {
      const currentSession = get().session

      shuffle = shuffle !== undefined ? shuffle : !!currentSession?.shuffleOrder

      const session: Session = {
        queue,
        title,
        type,
        contextId,
        progress: { position: 0, duration: 0, buffered: 0 },
        holdProgress: false,
        playerState: State.None,
        duckPaused: false,
        currentIdx: playIdx || 0,
        current: queue[playIdx || 0],
      }

      if (shuffle) {
        const { shuffled, order } = shuffleQueue(queue, playIdx)
        session.queue = shuffled
        session.shuffleOrder = order
        session.currentIdx = 0
      }

      set(state => {
        state.session = session
      })

      try {
        await TrackPlayer.destroy()
      } catch {}
      await TrackPlayer.setupPlayer(get()._getPlayerOptions())
      await get()._syncQueue()
      await TrackPlayer.play()
    })

    QueueEvents.emit('session-created')
  },

  setProgress: progress => {
    set(state => {
      if (!state.session) {
        return
      }

      state.session.progress = progress
    })
  },

  onSessionCreated: async () => {
    get()
      ._fetchQueueArtwork()
      .catch(() => {})
  },

  onPlaybackTrackChanged: async (nextTrack, track) => {
    if (get()._lockQueue) {
      return
    }

    await rntpCommands.enqueue(async () => {
      console.log('onPlaybackTrackChanged', { nextTrack, track })
      if (nextTrack === undefined || track === undefined) {
        return
      }

      const rntpQueue = await getRntpQueue()
      const rntpCurrentTrack = rntpQueue[nextTrack]

      const prevSession = get().session
      if (prevSession === undefined) {
        return
      }

      const { currentIdx: prevIdx } = prevSession

      set(state => {
        if (!state.session) {
          return
        }

        state.session.currentIdx = rntpCurrentTrack.idx
        state.session.current = state.session.queue[rntpCurrentTrack.idx]
      })

      const session = get().session!
      if (!session) {
        return
      }

      const { queue, currentIdx } = session

      // nextTrack === 2 here makes this only happen on queue loop, not on initial play of first track
      if (get().repeatMode === RepeatMode.Off && currentIdx === 0 && prevIdx === queue.length - 1 && nextTrack === 2) {
        await TrackPlayer.pause()
      }

      await get()._syncQueue()
    })
  },

  onPlaybackState: playbackState => {
    set(state => {
      if (!state.session) {
        return
      }

      state.session.playerState = playbackState
    })
  },

  onPlaybackError: async (code, message) => {
    // fix for ExoPlayer aborting playback while esimating content length
    if (code === 'playback-source' && message.includes('416')) {
      const playerState = get().session?.playerState || State.None
      const position = get().session?.progress.position

      await rntpCommands.enqueue(async () => {
        await get()._resetQueue(playerState, position)
      })
    }
  },

  onRemoteDuck: async (paused, permanent) =>
    rntpCommands.enqueue(async () => {
      if (permanent) {
        await TrackPlayer.stop()
        return
      }

      const session = get().session
      if (!session) {
        return
      }

      const { playerState, duckPaused } = session

      if (paused) {
        if (playerState === State.Playing || playerState === State.Buffering || playerState === State.Connecting) {
          await TrackPlayer.pause()
          set(state => {
            if (!state.session) {
              return
            }

            state.session.duckPaused = true
          })
        }
      } else if (duckPaused) {
        await TrackPlayer.play()
        set(state => {
          if (!state.session) {
            return
          }

          state.session.duckPaused = false
        })
      }
    }),

  onNetInfo: async netInfo => {
    const oldNetState = get().netState

    set(state => {
      state.netState = netInfo.type === NetInfoStateType.cellular ? 'mobile' : 'wifi'
    })

    const session = get().session
    if (!session) {
      return
    }

    const { progress, playerState } = session

    if (oldNetState !== get().netState) {
      await rntpCommands.enqueue(async () => {
        await get()._resetQueue(playerState, progress.position)
      })
    }
  },

  onSongChanged: async id => {
    if (!id) {
      return
    }

    const client = get().client
    if (!client) {
      return
    }

    if (!get().settings.scrobble) {
      return
    }

    try {
      await client.scrobble({ id })
    } catch {}
  },

  play: async () =>
    rntpCommands.enqueue(async () => {
      await TrackPlayer.play()
    }),

  pause: async () =>
    rntpCommands.enqueue(async () => {
      await TrackPlayer.pause()
    }),

  stop: async () =>
    rntpCommands.enqueue(async () => {
      try {
        await TrackPlayer.destroy()
      } catch {}
      set(state => {
        state.session = undefined
      })
    }),

  next: async () =>
    rntpCommands.enqueue(async () => {
      try {
        await TrackPlayer.skipToNext()
      } catch {}
    }),

  previous: async () =>
    rntpCommands.enqueue(async () => {
      const session = get().session
      if (!session) {
        return
      }

      const { currentIdx } = session

      if (currentIdx === 0 && get().repeatMode === RepeatMode.Off) {
        await TrackPlayer.seekTo(0)
        return
      }

      await TrackPlayer.skipToPrevious()
    }),

  skip: async track =>
    rntpCommands.enqueue(async () => {
      const session = get().session

      if (!session || track === session.currentIdx) {
        return
      }

      if (track === session.currentIdx + 1) {
        await TrackPlayer.skipToNext()
        return
      }
      if (track === session.currentIdx - 1) {
        await TrackPlayer.skipToPrevious()
        return
      }

      const { playerState } = session

      set(state => {
        if (!state.session) {
          return
        }

        state.session.currentIdx = track
        state.session.current = state.session.queue[state.session.currentIdx]
      })

      await get()._resetQueue(playerState)
    }),

  seek: async position =>
    rntpCommands.enqueue(async () => {
      await get()._seek(position)
    }),

  _seek: async position => {
    set(state => {
      if (!state.session) {
        return
      }

      state.session.holdProgress = true
      state.session.progress.position = position
    })
    await TrackPlayer.seekTo(position)
  },

  releaseProgressHold: () => {
    set(state => {
      if (!state.session) {
        return
      }

      state.session.holdProgress = false
    })
  },

  toggleRepeatMode: async () => {
    return rntpCommands.enqueue(async () => {
      let nextMode = RepeatMode.Off
      switch (get().repeatMode) {
        case RepeatMode.Off:
          nextMode = RepeatMode.Queue
          break
        case RepeatMode.Queue:
          nextMode = RepeatMode.Track
          break
        default:
          nextMode = RepeatMode.Off
          break
      }

      set(state => {
        state.repeatMode = nextMode
      })

      console.log('RepeatMode', RepeatMode[nextMode])
      await get()._syncQueue(true)
    })
  },

  toggleShuffle: async () =>
    rntpCommands.enqueue(async () => {
      const session = get().session
      if (!session) {
        return
      }

      const { queue, currentIdx, shuffleOrder } = session

      if (!shuffleOrder) {
        const { shuffled, order } = shuffleQueue(queue, currentIdx)

        set(state => {
          if (!state.session) {
            return
          }

          state.session.queue = shuffled
          state.session.currentIdx = 0
          state.session.current = state.session.queue[state.session.currentIdx]
          state.session.shuffleOrder = order
        })
      } else {
        const unshuffled = unshuffleQueue(queue, shuffleOrder)

        set(state => {
          if (!state.session) {
            return
          }

          state.session.queue = unshuffled
          state.session.currentIdx = shuffleOrder[currentIdx]
          state.session.current = state.session.queue[state.session.currentIdx]
          state.session.shuffleOrder = undefined
        })
      }

      await get()._syncQueue(true)
    }),

  destroy: async () =>
    rntpCommands.enqueue(async () => {
      try {
        await TrackPlayer.destroy()
      } catch {}
      set(state => {
        state.session = undefined
      })
    }),

  _syncQueue: async (rebuild = false) => {
    const rntpQueue = await getRntpQueue()
    if (rntpQueue.length > 3) {
      console.log('queue has more than 3 items, is currently being modified')
      return
    }

    const rntpCurrentIdx = await getRntpCurrentTrack()

    const session = get().session
    if (!session) {
      return
    }

    const { queue, currentIdx } = session

    if (rntpQueue.length === 3 && rntpCurrentIdx === 1 && !rebuild) {
      console.log('queue is already synced, nothing to do')
      return
    }

    const repeatMode = get().repeatMode
    const nextIdx = repeatMode === RepeatMode.Track ? currentIdx : (currentIdx + 1) % queue.length
    const prevIdx = repeatMode === RepeatMode.Track ? currentIdx : currentIdx === 0 ? queue.length - 1 : currentIdx - 1

    set(state => {
      state._lockQueue = true
    })

    if (rntpQueue.length === 0 && rntpCurrentIdx === undefined) {
      console.log('adding initial tracks')

      const tracks = await get()._mapSongs([
        { song: queue[prevIdx], idx: prevIdx },
        { song: queue[currentIdx], idx: currentIdx },
        { song: queue[nextIdx], idx: nextIdx },
      ])

      await TrackPlayer.add([tracks[1], tracks[2]])
      await TrackPlayer.add(tracks[0], 0)
    } else if (rntpQueue.length !== 3 || rntpCurrentIdx === undefined) {
      console.error('WHAT')
      console.log((await getRntpQueue()).map(t => t.title))
      throw new Error('this should not happen')
    } else if (rebuild) {
      console.log('rebuilding queue around current')

      const tracks = await get()._mapSongs([
        { song: queue[prevIdx], idx: prevIdx },
        { song: queue[currentIdx], idx: currentIdx },
        { song: queue[nextIdx], idx: nextIdx },
      ])

      await TrackPlayer.updateMetadataForTrack(rntpCurrentIdx, tracks[1])

      const toRemove = [0, 1, 2].filter(i => i !== rntpCurrentIdx)
      await TrackPlayer.remove(toRemove)

      await TrackPlayer.add(tracks[2])
      await TrackPlayer.add(tracks[0], 0)
    } else if (rntpCurrentIdx === 2) {
      console.log('adding next track')

      await TrackPlayer.add(await get()._mapSongs([{ song: queue[nextIdx], idx: nextIdx }]))
      await TrackPlayer.remove(0)
    } else if (rntpCurrentIdx === 0) {
      console.log('adding prev track')

      await TrackPlayer.add(await get()._mapSongs([{ song: queue[prevIdx], idx: prevIdx }]), 0)
      await TrackPlayer.remove(3)
    }

    set(state => {
      state._lockQueue = false
    })
  },

  _resetQueue: async (playerState, position) => {
    await TrackPlayer.reset()
    await get()._syncQueue()

    if (position !== undefined) {
      await get()._seek(position)
    }

    if (playerState === State.Playing || playerState === State.Buffering || playerState === State.Connecting) {
      await TrackPlayer.play()
    }
  },

  _getPlayerOptions: () => {
    const { minBuffer, maxBuffer } = get().settings

    return {
      minBuffer,
      playBuffer: minBuffer / 2,
      maxBuffer,
    }
  },

  _buildStreamUri: id => {
    const client = get().client
    if (!client) {
      throw new NoClientError()
    }

    return client.streamUri({
      id,
      estimateContentLength: true,
      maxBitRate: get().netState === 'mobile' ? get().settings.maxBitrateMobile : get().settings.maxBitrateWifi,
    })
  },

  _mapSongs: async songs => {
    const fallbackArt = require('@res/fallback.png')
    const albumIdCoverArtPath = await get()._cacheCoverArtPaths(songs.map(s => s.song))

    return songs.map(({ song, idx }) => ({
      id: song.id,
      idx,
      title: song.title,
      artist: song.artist || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      url: get()._buildStreamUri(song.id),
      artwork:
        song.albumId && albumIdCoverArtPath[song.albumId] ? `file://${albumIdCoverArtPath[song.albumId]}` : fallbackArt,
      userAgent,
      duration: song.duration,
      artistId: song.artistId,
      albumId: song.albumId,
      track: song.track,
      discNumber: song.discNumber,
    }))
  },

  _cacheCoverArtPaths: async (songs, fetchMessing = false, throwOnQueueChange = false) => {
    const session = get().session
    if (!session) {
      return {}
    }

    const { contextId } = session

    const throwIfQueueChanged = () => {
      if (!throwOnQueueChange) {
        return
      }

      if (contextId !== get().session?.contextId) {
        throw new Error('queue changed while fetching artwork')
      }
    }

    const albumIdImagePath: { [albumId: string]: string | undefined } = {}
    const albumIds = _.uniq(songs.map(s => s.albumId)).filter((id): id is string => id !== undefined)

    for (const albumId of albumIds) {
      let coverArt = queryClient.getQueryData<string>(qk.albumCoverArt(albumId))

      if (!coverArt) {
        throwIfQueueChanged()

        console.log('no cached coverArt for album', albumId, 'getting album...')
        coverArt = (await get()._getAlbum(albumId))?.album.coverArt

        if (!coverArt) {
          continue
        }
      }

      let imagePath =
        queryClient.getQueryData<string>(qk.existingFiles('coverArtThumb', coverArt)) ||
        queryClient.getQueryData<string>(qk.coverArt(coverArt, 'thumbnail'))

      if (!imagePath && fetchMessing) {
        throwIfQueueChanged()

        console.log('no cached image for', coverArt, 'getting file...')
        imagePath = (await get()._getCoverArtThumbExisting(coverArt)) || (await get()._getCoverArtThumb(coverArt))

        if (!imagePath) {
          continue
        }
      }

      albumIdImagePath[albumId] = imagePath
    }

    return albumIdImagePath
  },

  _fetchQueueArtwork: async () => {
    const session = get().session
    if (!session) {
      return
    }

    await get()._cacheCoverArtPaths(session.queue, true, true)

    await rntpCommands.enqueue(async () => {
      await get()._syncQueue(true)
    })
  },

  _getClient: () => {
    const client = get().client
    if (!client) {
      throw new Error('no client!')
    }

    return client
  },

  _getAlbum: async id => {
    try {
      const res = await fetchAlbum(id, get()._getClient())
      queryClient.setQueryData(qk.album(id), res)
      return res
    } catch {}
  },

  _getCoverArtThumbExisting: async coverArt => {
    const serverId = get().settings.activeServerId
    const options: FetchExisingFileOptions = { itemType: 'coverArtThumb', itemId: coverArt }

    try {
      const res = await fetchExistingFile(options, serverId)
      queryClient.setQueryData(qk.existingFiles(options.itemType, options.itemId), res)
      return res
    } catch {}
  },

  _getCoverArtThumb: async coverArt => {
    const serverId = get().settings.activeServerId
    const fromUrl = get()._getClient().getCoverArtUri({ id: coverArt, size: '256' })
    const options: FetchFileOptions = {
      itemType: 'coverArtThumb',
      itemId: coverArt,
      fromUrl,
      expectedContentType: 'image',
    }

    try {
      const res = await fetchFile(options, serverId)
      queryClient.setQueryData(qk.coverArt(coverArt, 'thumbnail'), res)
      return res
    } catch {}
  },
})

export const rntpCommands = new PromiseQueue(1)

const getRntpQueue = async (): Promise<TrackExt[]> => {
  return ((await TrackPlayer.getQueue()) as TrackExt[]) || []
}

const getRntpCurrentTrack = async (): Promise<number | undefined> => {
  const current = await TrackPlayer.getCurrentTrack()
  return typeof current === 'number' ? current : undefined
}

function shuffleQueue(queue: Song[], firstIdx?: number): { shuffled: Song[]; order: number[] } {
  const queueIndexes = queue.map((_t, i) => i)

  const order: number[] = []
  for (let i = queueIndexes.length; i--; i > 0) {
    const randi = Math.floor(Math.random() * (i + 1))
    order.push(queueIndexes.splice(randi, 1)[0])
  }

  if (firstIdx !== undefined) {
    order.splice(order.indexOf(firstIdx), 1)
    order.unshift(firstIdx)
  }

  return {
    shuffled: order.map(i => queue[i]),
    order,
  }
}

function unshuffleQueue(queue: Song[], shuffleOrder: number[]): Song[] {
  return shuffleOrder.map((_v, i) => queue[shuffleOrder.indexOf(i)])
}
