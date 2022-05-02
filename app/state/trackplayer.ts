import { NoClientError } from '@app/models/error'
import { Song } from '@app/models/library'
import { Progress, QueueType, TrackExt } from '@app/models/trackplayer'
import QueueEvents from '@app/trackplayer/QueueEvents'
import PromiseQueue from '@app/util/PromiseQueue'
import userAgent from '@app/util/userAgent'
import TrackPlayer, { PlayerOptions, RepeatMode, State } from 'react-native-track-player'
import { GetStore, SetStore, useStore } from './store'

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
  contextId: string
  shuffleOrder?: number[]
  playerState: State
  repeatMode: RepeatMode
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
  createSession: (options: CreateSessionOptions) => Promise<void>

  progress: Progress
  setProgress: (progress: Progress) => void

  scrobbleTrack: (id: string) => Promise<void>

  netState: 'mobile' | 'wifi'
  setNetState: (netState: 'mobile' | 'wifi') => Promise<void>

  buildStreamUri: (id: string) => string

  getPlayerOptions: () => PlayerOptions
}

export const rntpCommands = new PromiseQueue(1)

export type TrackPlayerServiceSlice = {
  onSession: () => Promise<void>
  onPlaybackTrackChanged: (nextTrack?: number, track?: number) => Promise<void>
  onPlaybackState: (state: State) => void
  onPlaybackError: (code: string, message: string) => Promise<void>
  onRemoteDuck: (paused: boolean, permanent: boolean) => Promise<void>

  play: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  skip: (track: number) => Promise<void>
  seek: (position: number) => Promise<void>
  toggleRepeatMode: () => Promise<void>
  toggleShuffle: () => Promise<void>
  reset: () => Promise<void>

  _syncQueue: (rebuild?: boolean) => Promise<void>
}

function mapSongToTrackExt(song: Song, idx: number): TrackExt {
  return {
    id: song.id,
    idx,
    title: song.title,
    artist: song.artist || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    url: useStore.getState().buildStreamUri(song.id),
    artwork: require('@res/fallback.png'),
    userAgent,
    duration: song.duration,
    artistId: song.artistId,
    albumId: song.albumId,
    track: song.track,
    discNumber: song.discNumber,
  }
}

export const createTrackPlayerServiceSlice = (set: SetStore, get: GetStore): TrackPlayerServiceSlice => ({
  onSession: async () =>
    rntpCommands.enqueue(async () => {
      try {
        await TrackPlayer.destroy()
      } catch {}
      await TrackPlayer.setupPlayer(get().getPlayerOptions())

      await get()._syncQueue()
      await TrackPlayer.play()
    }),

  onPlaybackTrackChanged: async (nextTrack, track) =>
    rntpCommands.enqueue(async () => {
      if (nextTrack === undefined || track === undefined) {
        return
      }

      const rntpQueue = await getQueue()
      const rntpCurrentTrack = rntpQueue[nextTrack]

      const prevIdx = get().session?.currentIdx
      if (prevIdx === undefined) {
        return
      }

      set(state => {
        if (!state.session) {
          return
        }

        state.session.currentIdx = rntpCurrentTrack.idx
        state.session.current = state.session.queue[rntpCurrentTrack.idx]
      })

      const session = get().session
      if (!session) {
        return
      }

      const { queue, currentIdx, repeatMode } = session

      // nextTrack === 2 here makes this only happen on queue loop, not on initial play of first track
      if (repeatMode === RepeatMode.Off && currentIdx === 0 && prevIdx === queue.length - 1 && nextTrack === 2) {
        await TrackPlayer.pause()
      }

      await get()._syncQueue()
    }),

  onPlaybackState: playbackState => {
    set(state => {
      if (!state.session) {
        return
      }

      state.session.playerState = playbackState
    })
  },

  onPlaybackError: async (code, message) =>
    rntpCommands.enqueue(async () => {
      return
    }),

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

      const { currentIdx, repeatMode } = session

      if (currentIdx === 0 && repeatMode === RepeatMode.Off) {
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

      await TrackPlayer.reset()
      await get()._syncQueue()

      if (playerState === State.Playing || playerState === State.Buffering || playerState === State.Connecting) {
        await TrackPlayer.play()
      }
    }),

  seek: async position =>
    rntpCommands.enqueue(async () => {
      await TrackPlayer.seekTo(position)
    }),

  toggleRepeatMode: async () => {
    return rntpCommands.enqueue(async () => {
      const session = get().session
      if (!session) {
        return
      }

      const { repeatMode } = session
      let nextMode = RepeatMode.Off

      switch (repeatMode) {
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
        if (!state.session) {
          return
        }

        state.session.repeatMode = nextMode
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

      console.log(get().session!.queue.map(s => s.title))
      await get()._syncQueue(true)
    }),

  reset: async () =>
    rntpCommands.enqueue(async () => {
      try {
        await TrackPlayer.destroy()
      } catch {}
      set(state => {
        state.session = undefined
      })
    }),

  _syncQueue: async rebuild => {
    rebuild = rebuild || false

    const rntpQueue = await getQueue()
    if (rntpQueue.length > 3) {
      console.log('queue has more than 3 items, is currently being modified')
      return
    }

    const rntpCurrentIdx = await getCurrentTrack()

    const session = get().session
    if (!session) {
      return
    }

    const { queue, currentIdx, repeatMode } = session

    if (rntpQueue.length === 3 && rntpCurrentIdx === 1 && !rebuild) {
      console.log('queue is already synced, nothing to do')
      console.log((await getQueue()).map(t => t.title))
      return
    }

    const getNextIdx = () => {
      if (repeatMode === RepeatMode.Track) {
        return currentIdx
      }
      return (currentIdx + 1) % queue.length
    }

    const getPrevIdx = () => {
      if (repeatMode === RepeatMode.Track) {
        return currentIdx
      }
      return currentIdx === 0 ? queue.length - 1 : currentIdx - 1
    }

    if (rntpQueue.length === 0 && rntpCurrentIdx === undefined) {
      console.log('adding initial tracks')
      const nextIdx = getNextIdx()
      const prevIdx = getPrevIdx()

      await TrackPlayer.add([
        mapSongToTrackExt(queue[currentIdx], currentIdx),
        mapSongToTrackExt(queue[nextIdx], nextIdx),
      ])
      await TrackPlayer.add(mapSongToTrackExt(queue[prevIdx], prevIdx), 0)
      console.log((await getQueue()).map(t => t.title))
      return
    }

    if (rntpQueue.length !== 3 || rntpCurrentIdx === undefined) {
      console.log((await getQueue()).map(t => t.title))
      throw new Error('this should not happen')
    }

    if (rebuild) {
      console.log('rebuilding queue around current')
      const currentTrack = rntpQueue[rntpCurrentIdx]
      const toRemove = [0, 1, 2].filter(i => i !== rntpCurrentIdx)
      await TrackPlayer.remove(toRemove)

      const nextIdx = getNextIdx()
      const prevIdx = getPrevIdx()

      await TrackPlayer.add(mapSongToTrackExt(queue[nextIdx], nextIdx))
      await TrackPlayer.add(mapSongToTrackExt(queue[prevIdx], prevIdx), 0)

      await TrackPlayer.updateMetadataForTrack(rntpCurrentIdx, { ...currentTrack, idx: currentIdx } as TrackExt)
      console.log((await getQueue()).map(t => t.title))
      return
    }

    if (rntpCurrentIdx === 2) {
      console.log('adding next track')
      const nextIdx = getNextIdx()
      await TrackPlayer.add(mapSongToTrackExt(queue[nextIdx], nextIdx))
      await TrackPlayer.remove(0)
      console.log((await getQueue()).map(t => t.title))
      return
    }

    if (rntpCurrentIdx === 0) {
      console.log('adding prev track')
      const prevIdx = getPrevIdx()
      await TrackPlayer.add(mapSongToTrackExt(queue[prevIdx], prevIdx), 0)
      await TrackPlayer.remove(3)
      console.log((await getQueue()).map(t => t.title))
      return
    }
  },
})

export const createTrackPlayerSlice = (set: SetStore, get: GetStore): TrackPlayerSlice => ({
  createSession: async ({ queue, type, title, contextId, playIdx, shuffle }) => {
    return rntpCommands.enqueue(async () => {
      const currentSession = get().session

      shuffle = shuffle !== undefined ? shuffle : !!currentSession?.shuffleOrder

      if (queue.length === 0) {
        set(state => {
          state.session = undefined
        })
        QueueEvents.emit('session')
        return
      }

      const session: Session = {
        queue,
        title,
        type,
        contextId,
        progress: { position: 0, duration: 0, buffered: 0 },
        playerState: State.None,
        repeatMode: RepeatMode.Off,
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
      QueueEvents.emit('session')
    })
  },

  progress: { position: 0, duration: 0, buffered: 0 },
  setProgress: progress =>
    set(state => {
      state.progress = progress
    }),

  scrobbleTrack: async id => {
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

  netState: 'mobile',
  setNetState: async netState => {
    if (netState === get().netState) {
      return
    }
    set(state => {
      state.netState = netState
    })
    // get().rebuildQueue()
  },

  buildStreamUri: id => {
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

  getPlayerOptions: () => {
    return {
      minBuffer: get().settings.minBuffer,
      playBuffer: get().settings.minBuffer / 2,
      maxBuffer: get().settings.maxBuffer,
    }
  },
})

export const getQueue = async (): Promise<TrackExt[]> => {
  return ((await TrackPlayer.getQueue()) as TrackExt[]) || []
}

export const getCurrentTrack = async (): Promise<number | undefined> => {
  const current = await TrackPlayer.getCurrentTrack()
  return typeof current === 'number' ? current : undefined
}

export const getPlayerState = async (): Promise<State> => {
  return (await TrackPlayer.getState()) || State.None
}

export const getRepeatMode = async (): Promise<RepeatMode> => {
  return (await TrackPlayer.getRepeatMode()) || RepeatMode.Off
}

function shuffleTracks(tracks: TrackExt[], firstTrack?: number) {
  if (tracks.length === 0) {
    return { tracks, shuffleOrder: [] }
  }

  const trackIndexes = tracks.map((_t, i) => i)
  let shuffleOrder: number[] = []

  for (let i = trackIndexes.length; i--; i > 0) {
    const randi = Math.floor(Math.random() * (i + 1))
    shuffleOrder.push(trackIndexes.splice(randi, 1)[0])
  }

  if (firstTrack !== undefined) {
    shuffleOrder.splice(shuffleOrder.indexOf(firstTrack), 1)
    shuffleOrder = [firstTrack, ...shuffleOrder]
  }

  tracks = shuffleOrder.map(i => tracks[i])

  return { tracks, shuffleOrder }
}

function unshuffleTracks(tracks: TrackExt[], shuffleOrder: number[]): TrackExt[] {
  if (tracks.length === 0 || shuffleOrder.length === 0) {
    return tracks
  }

  return shuffleOrder.map((_v, i) => tracks[shuffleOrder.indexOf(i)])
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
