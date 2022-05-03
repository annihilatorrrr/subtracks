import NetInfo from '@react-native-community/netinfo'
import { unstable_batchedUpdates } from 'react-native'
import TrackPlayer, { Event, State } from 'react-native-track-player'
import { useStore } from '../state/store'
import QueueEvents from './QueueEvents'

let serviceCreated = false

const createService = async () => {
  useStore.subscribe(
    state => state.session?.current.id,
    (currentId?: string) => {
      unstable_batchedUpdates(() => {
        useStore.getState().onSongChanged(currentId)
      })
    },
  )

  NetInfo.fetch().then(netInfo => {
    unstable_batchedUpdates(() => {
      useStore.getState().onNetInfo(netInfo)
    })
  })

  NetInfo.addEventListener(netInfo => {
    unstable_batchedUpdates(() => {
      useStore.getState().onNetInfo(netInfo)
    })
  })

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    unstable_batchedUpdates(() => {
      useStore.getState().stop()
    })
  })

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    unstable_batchedUpdates(() => {
      useStore.getState().play()
    })
  })
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    unstable_batchedUpdates(() => {
      useStore.getState().pause()
    })
  })

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    unstable_batchedUpdates(() => {
      useStore.getState().next()
    })
  })

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    unstable_batchedUpdates(() => {
      useStore.getState().previous()
    })
  })

  TrackPlayer.addEventListener(Event.RemoteDuck, event => {
    console.log('RemoteDuck', event)
    unstable_batchedUpdates(() => {
      useStore.getState().onRemoteDuck(event.paused, event.permanent)
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackState, event => {
    console.log('PlaybackState', State[event.state])
    unstable_batchedUpdates(() => {
      useStore.getState().onPlaybackState(event.state)
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, event => {
    unstable_batchedUpdates(() => {
      useStore.getState().onPlaybackTrackChanged(event.nextTrack, event.track)
    })
  })

  TrackPlayer.addEventListener(Event.RemoteSeek, event => {
    unstable_batchedUpdates(() => {
      useStore.getState().seek(event.position)
    })
  })

  TrackPlayer.addEventListener(Event.PlaybackError, event => {
    console.log('PlaybackError', event)
    unstable_batchedUpdates(() => {
      useStore.getState().onPlaybackError(event.code, event.message)
    })
  })

  QueueEvents.addListener('session-created', () => {
    unstable_batchedUpdates(() => {
      useStore.getState().onSessionCreated()
    })
  })
}

module.exports = async function () {
  if (!serviceCreated) {
    createService()
    serviceCreated = true
  }
}
