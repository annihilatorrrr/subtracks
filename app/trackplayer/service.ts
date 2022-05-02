import { fetchAlbum } from '@app/query/fetch/api'
import { FetchExisingFileOptions, fetchExistingFile, fetchFile, FetchFileOptions } from '@app/query/fetch/file'
import qk from '@app/query/queryKeys'
import { rntpCommands } from '@app/state/trackplayer'
import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo'
import _ from 'lodash'
import { unstable_batchedUpdates } from 'react-native'
import TrackPlayer, { Event, State } from 'react-native-track-player'
import queryClient from '../query/queryClient'
import { useStore } from '../state/store'
import { ReturnedPromiseResolvedType } from '../util/types'
import QueueEvents from './QueueEvents'

// const reset = () => {
//   unstable_batchedUpdates(() => {
//     useStore.getState().resetTrackPlayerState()
//   })
// }

const setNetState = (netState: 'mobile' | 'wifi') => {
  unstable_batchedUpdates(() => {
    useStore.getState().setNetState(netState)
  })
}

const setQueryDataAlbum = (queryKey: any, data: ReturnedPromiseResolvedType<typeof fetchAlbum>) => {
  unstable_batchedUpdates(() => {
    queryClient.setQueryData(queryKey, data)
  })
}

const setQueryDataExistingFiles = (queryKey: any, data: ReturnedPromiseResolvedType<typeof fetchExistingFile>) => {
  unstable_batchedUpdates(() => {
    queryClient.setQueryData(queryKey, data)
  })
}

const setQueryDataCoverArt = (queryKey: any, data: ReturnedPromiseResolvedType<typeof fetchFile>) => {
  unstable_batchedUpdates(() => {
    queryClient.setQueryData(queryKey, data)
  })
}

function getClient() {
  const client = useStore.getState().client
  if (!client) {
    throw new Error('no client!')
  }

  return client
}

async function getAlbum(id: string) {
  try {
    const res = await fetchAlbum(id, getClient())
    setQueryDataAlbum(qk.album(id), res)
    return res
  } catch {}
}

async function getCoverArtThumbExisting(coverArt: string) {
  const serverId = useStore.getState().settings.activeServerId
  const options: FetchExisingFileOptions = { itemType: 'coverArtThumb', itemId: coverArt }

  try {
    const res = await fetchExistingFile(options, serverId)
    setQueryDataExistingFiles(qk.existingFiles(options.itemType, options.itemId), res)
    return res
  } catch {}
}

async function getCoverArtThumb(coverArt: string) {
  const serverId = useStore.getState().settings.activeServerId
  const fromUrl = getClient().getCoverArtUri({ id: coverArt, size: '256' })
  const options: FetchFileOptions = {
    itemType: 'coverArtThumb',
    itemId: coverArt,
    fromUrl,
    expectedContentType: 'image',
  }

  try {
    const res = await fetchFile(options, serverId)
    setQueryDataCoverArt(qk.coverArt(coverArt, 'thumbnail'), res)
    return res
  } catch {}
}

let serviceCreated = false

const createService = async () => {
  // useStore.subscribe(
  //   state => state.currentTrack?.id,
  //   (currentTrackId?: string) => {
  //     if (currentTrackId) {
  //       useStore.getState().scrobbleTrack(currentTrackId)
  //     }
  //   },
  // )

  NetInfo.fetch().then(state => {
    setNetState(state.type === NetInfoStateType.cellular ? 'mobile' : 'wifi')
  })

  NetInfo.addEventListener(state => {
    const currentType = useStore.getState().netState
    const newType = state.type === NetInfoStateType.cellular ? 'mobile' : 'wifi'
    if (currentType !== newType) {
      setNetState(newType)
    }
  })

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    // reset()
    // trackPlayerCommands.enqueue(TrackPlayer.destroy)
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
    console.log('PlaybackTrackChanged', event)

    unstable_batchedUpdates(() => {
      useStore.getState().onPlaybackTrackChanged(event.nextTrack, event.track)
    })
    // useStore.getState().setProgress({ position: 0, duration: 0, buffered: 0 })
    // trackPlayerCommands.enqueue(async () => {
    //   setCurrentTrackIdx(await getCurrentTrack())
    // })
  })

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, event => {
    console.log('PlaybackQueueEnded', event)
    const { position, track } = event

    // bogus event that fires when queue is changed
    if (!track && position === 0) {
      return
    }

    // trackPlayerCommands.enqueue(async () => {
    //   await TrackPlayer.stop()
    //   await TrackPlayer.skip(0)
    // })
  })

  // TrackPlayer.addEventListener(Event.PlaybackMetadataReceived, () => {
  //   setCurrentTrackIdx(useStore.getState().currentTrackIdx)
  // })

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

    // fix for ExoPlayer aborting playback while esimating content length
    if (event.code === 'playback-source' && event.message.includes('416')) {
      // rebuildQueue(true)
    }
  })

  QueueEvents.addListener('session', () => {
    unstable_batchedUpdates(() => {
      useStore.getState().onSession()
    })
  })

  // QueueEvents.addListener('set', async ({ queue }) => {
  //   const contextId = useStore.getState().queueContextId
  //   const throwIfQueueChanged = () => {
  //     if (contextId !== useStore.getState().queueContextId) {
  //       throw 'queue-changed'
  //     }
  //   }

  //   const albumIds = _.uniq(queue.map(s => s.albumId)).filter((id): id is string => id !== undefined)

  //   const albumIdImagePath: { [albumId: string]: string | undefined } = {}
  //   for (const albumId of albumIds) {
  //     let coverArt = queryClient.getQueryData<string>(qk.albumCoverArt(albumId))
  //     if (!coverArt) {
  //       throwIfQueueChanged()
  //       console.log('no cached coverArt for album', albumId, 'getting album...')
  //       coverArt = (await getAlbum(albumId))?.album.coverArt
  //       if (!coverArt) {
  //         continue
  //       }
  //     }

  //     let imagePath =
  //       queryClient.getQueryData<string>(qk.existingFiles('coverArtThumb', coverArt)) ||
  //       queryClient.getQueryData<string>(qk.coverArt(coverArt, 'thumbnail'))
  //     if (!imagePath) {
  //       throwIfQueueChanged()
  //       console.log('no cached image for', coverArt, 'getting file...')
  //       imagePath = (await getCoverArtThumbExisting(coverArt)) || (await getCoverArtThumb(coverArt))
  //       if (!imagePath) {
  //         continue
  //       }
  //     }

  //     albumIdImagePath[albumId] = imagePath
  //   }

  //   for (let i = 0; i < queue.length; i++) {
  //     const track = queue[i]
  //     if (typeof track.artwork === 'string') {
  //       continue
  //     }

  //     if (!track.albumId) {
  //       continue
  //     }

  //     let imagePath = albumIdImagePath[track.albumId]
  //     if (!imagePath) {
  //       continue
  //     }

  //     try {
  //       throwIfQueueChanged()

  //       let trackIdx = i
  //       const shuffleOrder = useStore.getState().shuffleOrder
  //       if (shuffleOrder) {
  //         trackIdx = shuffleOrder.indexOf(i)
  //       }

  //       await TrackPlayer.updateMetadataForTrack(trackIdx, { ...track, artwork: `file://${imagePath}` })
  //     } catch {
  //       break
  //     }
  //   }

  //   await rntpCommands.enqueue(async () => {
  //     updateQueue()
  //   })
  // })
}

module.exports = async function () {
  if (!serviceCreated) {
    createService()
    serviceCreated = true
  }
}
