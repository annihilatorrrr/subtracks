import { getCurrentTrack, getPlayerState, trackPlayerCommands } from '@app/state/trackplayer'
import TrackPlayer, { Event, State } from 'react-native-track-player'
import { useStore } from './state/store'
import { unstable_batchedUpdates } from 'react-native'

const reset = () => {
  unstable_batchedUpdates(() => {
    useStore.getState().resetTrackPlayerState()
  })
}

const setPlayerState = (state: State) => {
  unstable_batchedUpdates(() => {
    useStore.getState().setPlayerState(state)
  })
}

const setCurrentTrackIdx = (idx?: number) => {
  unstable_batchedUpdates(() => {
    useStore.getState().setCurrentTrackIdx(idx)
  })
}

const rebuildQueue = (forcePlay?: boolean) => {
  unstable_batchedUpdates(() => {
    useStore.getState().rebuildQueue(forcePlay)
  })
}

const setDuckPaused = (duckPaused: boolean) => {
  unstable_batchedUpdates(() => {
    useStore.getState().setDuckPaused(duckPaused)
  })
}

let serviceCreated = false

const createService = async () => {
  useStore.subscribe(
    state => state.currentTrack?.id,
    (currentTrackId?: string) => {
      if (currentTrackId) {
        useStore.getState().scrobbleTrack(currentTrackId)
      }
    },
  )

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    reset()
    trackPlayerCommands.enqueue(TrackPlayer.reset)
  })

  TrackPlayer.addEventListener(Event.RemotePlay, () => trackPlayerCommands.enqueue(TrackPlayer.play))
  TrackPlayer.addEventListener(Event.RemotePause, () => trackPlayerCommands.enqueue(TrackPlayer.pause))

  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    trackPlayerCommands.enqueue(() => TrackPlayer.skipToNext().catch(() => {})),
  )
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    trackPlayerCommands.enqueue(() => TrackPlayer.skipToPrevious().catch(() => {})),
  )

  TrackPlayer.addEventListener(Event.RemoteDuck, data => {
    if (data.permanent) {
      trackPlayerCommands.enqueue(TrackPlayer.stop)
      return
    }

    if (data.paused) {
      let state = useStore.getState().playerState
      if (state === State.Playing || state === State.Buffering || state === State.Connecting) {
        trackPlayerCommands.enqueue(TrackPlayer.pause)
        setDuckPaused(true)
      }
    } else if (useStore.getState().duckPaused) {
      trackPlayerCommands.enqueue(TrackPlayer.play)
      setDuckPaused(false)
    }
  })

  TrackPlayer.addEventListener(Event.PlaybackState, () => {
    trackPlayerCommands.enqueue(async () => {
      setPlayerState(await getPlayerState())
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
    useStore.getState().setProgress({ position: 0, duration: 0, buffered: 0 })
    trackPlayerCommands.enqueue(async () => {
      setCurrentTrackIdx(await getCurrentTrack())
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, event => {
    const { position, track } = event

    // bogus event that fires when queue is changed
    if (!track && position === 0) {
      return
    }

    trackPlayerCommands.enqueue(async () => {
      await TrackPlayer.stop()
      await TrackPlayer.skip(0)
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackMetadataReceived, () => {
    setCurrentTrackIdx(useStore.getState().currentTrackIdx)
  })

  TrackPlayer.addEventListener(Event.RemoteSeek, data => {
    trackPlayerCommands.enqueue(async () => {
      await TrackPlayer.seekTo(data.position)
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackError, data => {
    const { code, message } = data as Record<string, string>

    console.log('error', data)

    // fix for ExoPlayer aborting playback while esimating content length
    if (code === 'playback-source' && message.includes('416')) {
      rebuildQueue(true)
    }
  })
}

module.exports = async function () {
  if (!serviceCreated) {
    createService()
    serviceCreated = true
  }
}
