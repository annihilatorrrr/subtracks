import { NoClientError } from '@app/models/error'
import { Song } from '@app/models/library'
import { Progress, QueueType, TrackExt } from '@app/models/trackplayer'
import QueueEvents from '@app/trackplayer/QueueEvents'
import PromiseQueue from '@app/util/PromiseQueue'
import userAgent from '@app/util/userAgent'
import produce from 'immer'
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

  queueName?: string
  setQueueName: (name?: string) => void

  queueContextType?: QueueType
  setQueueContextType: (queueContextType?: QueueType) => void

  queueContextId?: string
  setQueueContextId: (queueContextId?: string) => void

  shuffleOrder?: number[]
  toggleShuffle: () => Promise<void>

  // repeatMode: RepeatMode
  // toggleRepeatMode: () => Promise<void>

  playerState: State
  setPlayerState: (playerState: State) => void

  duckPaused: boolean
  setDuckPaused: (duckPaused: boolean) => void

  currentTrack?: TrackExt
  currentTrackIdx?: number
  setCurrentTrackIdx: (idx?: number) => void

  queue: TrackExt[]
  setQueue: (options: SetQueueOptionsInternal) => Promise<void>

  progress: Progress
  setProgress: (progress: Progress) => void

  scrobbleTrack: (id: string) => Promise<void>

  netState: 'mobile' | 'wifi'
  setNetState: (netState: 'mobile' | 'wifi') => Promise<void>

  rebuildQueue: (forcePlay?: boolean) => Promise<void>
  updateQueue: () => Promise<void>
  buildStreamUri: (id: string) => string
  resetTrackPlayerState: () => void

  getPlayerOptions: () => PlayerOptions
}

export const trackPlayerCommands = new PromiseQueue(1)

export type TrackPlayerServiceSlice = {
  onSession: () => Promise<void>
  onTrackChanged: (nextTrack?: number, track?: number) => Promise<void>
  onQueueEnded: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  toggleRepeatMode: () => Promise<void>
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
    trackPlayerCommands.enqueue(async () => {
      try {
        await TrackPlayer.destroy()
      } catch {}
      await TrackPlayer.setupPlayer(get().getPlayerOptions())

      await get()._syncQueue()
      await TrackPlayer.play()
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
      return
    }

    if (rntpQueue.length !== 3 || rntpCurrentIdx === undefined) {
      console.warn('this should not happen')
    }

    if (rebuild) {
      console.log('rebuilding queue around current')
      const toRemove = [0, 1, 2].filter(i => i !== rntpCurrentIdx)
      console.log('toRemove', toRemove)
      await TrackPlayer.remove(toRemove)
      console.log(
        'queue after remove',
        (await getQueue()).map(t => t.title),
      )

      const nextIdx = getNextIdx()
      const prevIdx = getPrevIdx()

      await TrackPlayer.add(mapSongToTrackExt(queue[nextIdx], nextIdx))
      await TrackPlayer.add(mapSongToTrackExt(queue[prevIdx], prevIdx), 0)
      return
    }

    if (rntpCurrentIdx === 2) {
      console.log('adding next track')
      const nextIdx = getNextIdx()
      await TrackPlayer.add(mapSongToTrackExt(queue[nextIdx], nextIdx))
      await TrackPlayer.remove(0)
      return
    }

    if (rntpCurrentIdx === 0) {
      console.log('adding prev track')
      const prevIdx = getPrevIdx()
      await TrackPlayer.add(mapSongToTrackExt(queue[prevIdx], prevIdx), 0)
      await TrackPlayer.remove(3)
      return
    }
  },

  onTrackChanged: async nextTrack =>
    trackPlayerCommands.enqueue(async () => {
      if (nextTrack === undefined) {
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

      console.log((await getQueue()).map(t => t.title))
    }),

  onQueueEnded: async () => {
    set(state => {
      delete state.session
    })
  },

  play: async () =>
    trackPlayerCommands.enqueue(async () => {
      await TrackPlayer.play()
    }),

  pause: async () =>
    trackPlayerCommands.enqueue(async () => {
      await TrackPlayer.pause()
    }),

  stop: async () =>
    trackPlayerCommands.enqueue(async () => {
      // await TrackPlayer.destroy()
      get().toggleRepeatMode()
    }),

  next: async () =>
    trackPlayerCommands.enqueue(async () => {
      try {
        await TrackPlayer.skipToNext()
      } catch {}
    }),

  previous: async () =>
    trackPlayerCommands.enqueue(async () => {
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

  toggleRepeatMode: async () => {
    return trackPlayerCommands.enqueue(async () => {
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
})

export const createTrackPlayerSlice = (set: SetStore, get: GetStore): TrackPlayerSlice => ({
  queueName: undefined,
  setQueueName: name =>
    set(state => {
      state.queueName = name
    }),

  queueContextType: undefined,
  setQueueContextType: queueContextType =>
    set(state => {
      state.queueContextType = queueContextType
    }),

  queueContextId: undefined,
  setQueueContextId: queueContextId =>
    set(state => {
      state.queueContextId = queueContextId
    }),

  shuffleOrder: undefined,
  toggleShuffle: async () => {
    return trackPlayerCommands.enqueue(async () => {
      const queue = await getQueue()
      const current = await getCurrentTrack()
      const queueShuffleOrder = get().shuffleOrder

      await TrackPlayer.remove(queue.map((_t, i) => i).filter(i => i !== current))

      if (queueShuffleOrder === undefined) {
        let { tracks, shuffleOrder } = shuffleTracks(queue, current)
        if (tracks.length > 0) {
          tracks = tracks.slice(1)
        }

        await TrackPlayer.add(tracks)
        set(state => {
          state.shuffleOrder = shuffleOrder
        })
      } else {
        const tracks = unshuffleTracks(queue, queueShuffleOrder)

        if (current !== undefined) {
          const shuffledCurrent = queueShuffleOrder[current]
          const tracks1 = tracks.slice(0, shuffledCurrent)
          const tracks2 = tracks.slice(shuffledCurrent + 1)

          await TrackPlayer.add(tracks2)
          await TrackPlayer.add(tracks1, 0)
        } else {
          await TrackPlayer.add(tracks)
        }

        set(state => {
          state.shuffleOrder = undefined
        })
      }

      const newQueue = await getQueue()
      const newCurrentTrackIdx = await getCurrentTrack()

      set(state => {
        state.queue = newQueue
      })
      get().setCurrentTrackIdx(newCurrentTrackIdx)
    })
  },

  playerState: State.None,
  setPlayerState: playerState =>
    set(state => {
      state.playerState = playerState
    }),

  currentTrack: undefined,
  currentTrackIdx: undefined,
  setCurrentTrackIdx: idx => {
    set(
      produce<TrackPlayerSlice>(state => {
        state.currentTrackIdx = idx
        state.currentTrack = idx !== undefined ? state.queue[idx] : undefined
      }),
    )
  },

  duckPaused: false,
  setDuckPaused: duckPaused =>
    set(state => {
      state.duckPaused = duckPaused
    }),

  createSession: async ({ queue, type, title, contextId, playIdx, shuffle }) => {
    return trackPlayerCommands.enqueue(async () => {
      const currentSession = get().session

      shuffle = shuffle !== undefined ? shuffle : !!currentSession?.shuffleOrder

      if (queue.length === 0) {
        set(state => {
          delete state.session
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
        repeatMode: RepeatMode.Off,
        duckPaused: false,
        currentIdx: playIdx || 0,
        current: queue[playIdx || 0],
      }

      if (shuffle) {
        const { shuffled, shuffleOrder } = shuffleQueue(queue, playIdx)
        session.queue = shuffled
        session.shuffleOrder = shuffleOrder
        session.currentIdx = 0
      }

      set(state => {
        state.session = session
      })
      QueueEvents.emit('session')
    })
  },

  queue: [],
  setQueue: async ({ queue, title, type, contextId, playTrack, shuffle }) => {
    return trackPlayerCommands.enqueue(async () => {
      const shuffled = shuffle !== undefined ? shuffle : !!get().shuffleOrder

      await TrackPlayer.setupPlayer(get().getPlayerOptions())
      await TrackPlayer.reset()

      if (queue.length === 0) {
        return
      }

      if (shuffled) {
        const { tracks, shuffleOrder } = shuffleTracks(queue, playTrack)
        set(state => {
          state.shuffleOrder = shuffleOrder
        })
        queue = tracks
        playTrack = 0
      } else {
        set(state => {
          state.shuffleOrder = undefined
        })
      }

      playTrack = playTrack || 0

      try {
        set(state => {
          state.queue = queue
          state.queueName = title
          state.queueContextType = type
          state.queueContextId = contextId
        })
        get().setCurrentTrackIdx(playTrack)

        if (playTrack === 0) {
          await TrackPlayer.add(queue)
        } else {
          const tracks1 = queue.slice(0, playTrack)
          const tracks2 = queue.slice(playTrack)

          await TrackPlayer.add(tracks2)
          await TrackPlayer.add(tracks1, 0)
        }

        await TrackPlayer.play()
      } catch {
        get().resetTrackPlayerState()
        await TrackPlayer.reset()
      }
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
    get().rebuildQueue()
  },

  rebuildQueue: async forcePlay => {
    return trackPlayerCommands.enqueue(async () => {
      const queue = await getQueue()
      if (!queue.length) {
        return
      }

      const currentTrack = await getCurrentTrack()
      const playerState = await getPlayerState()
      const position = (await TrackPlayer.getPosition()) || 0
      const repeatMode = await getRepeatMode()

      const queueName = get().queueName
      const queueContextId = get().queueContextId
      const queueContextType = get().queueContextType

      await TrackPlayer.reset()
      await TrackPlayer.setupPlayer(get().getPlayerOptions())

      try {
        for (const track of queue) {
          track.url = get().buildStreamUri(track.id)
        }
      } catch {
        return
      }

      set(state => {
        state.queue = queue
        state.queueName = queueName
        state.queueContextType = queueContextType
        state.queueContextId = queueContextId
      })
      get().setCurrentTrackIdx(currentTrack)

      await TrackPlayer.add(queue)

      if (currentTrack) {
        await TrackPlayer.skip(currentTrack)
      }

      await TrackPlayer.setRepeatMode(repeatMode)
      await TrackPlayer.seekTo(position)

      if (playerState === State.Playing || forcePlay) {
        await TrackPlayer.play()
      }
    })
  },

  updateQueue: async () => {
    const newQueue = await getQueue()
    const currentTrack = await getCurrentTrack()
    set(state => {
      state.queue = newQueue
      if (currentTrack !== undefined) {
        state.currentTrack = newQueue[currentTrack]
      }
    })
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

  resetTrackPlayerState: () => {
    set(state => {
      state.queueName = undefined
      state.queueContextType = undefined
      state.queueContextId = undefined
      state.shuffleOrder = undefined
      // state.repeatMode = RepeatMode.Off
      state.playerState = State.None
      state.currentTrack = undefined
      state.currentTrackIdx = undefined
      state.queue = []
      state.progress = { position: 0, duration: 0, buffered: 0 }
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

function shuffleQueue(queue: Song[], firstIdx?: number): { shuffled: Song[]; shuffleOrder: number[] } {
  const queueIndexes = queue.map((_t, i) => i)

  const shuffleOrder: number[] = []
  for (let i = queueIndexes.length; i--; i > 0) {
    const randi = Math.floor(Math.random() * (i + 1))
    shuffleOrder.push(queueIndexes.splice(randi, 1)[0])
  }

  if (firstIdx !== undefined) {
    shuffleOrder.splice(shuffleOrder.indexOf(firstIdx), 1)
    shuffleOrder.unshift(firstIdx)
  }

  return {
    shuffled: shuffleOrder.map(i => queue[i]),
    shuffleOrder,
  }
}

function unshuffleQueue(queue: Song[], shuffleOrder: number[]): Song[] {
  return shuffleOrder.map((_v, i) => queue[shuffleOrder.indexOf(i)])
}
