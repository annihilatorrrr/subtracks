import { Song } from '@app/models/library'
import { QueueType, TrackExt } from '@app/models/trackplayer'
import queryClient from '@app/query/queryClient'
import { useStore, useStoreDeep } from '@app/state/store'
import { getQueue, SetQueueOptions, rntpCommands } from '@app/state/trackplayer'
import userAgent from '@app/util/userAgent'
import TrackPlayer from 'react-native-track-player'
import qk from '@app/query/queryKeys'

// export const usePlay = () => {
//   return () => rntpCommands.enqueue(() => TrackPlayer.play())
// }

// export const usePause = () => {
//   return () => rntpCommands.enqueue(() => TrackPlayer.pause())
// }

// export const usePrevious = () => {
//   return () =>
//     rntpCommands.enqueue(async () => {
//       const [current] = await Promise.all([await TrackPlayer.getCurrentTrack(), await getQueue()])
//       if (current > 0) {
//         await TrackPlayer.skipToPrevious()
//       } else {
//         await TrackPlayer.seekTo(0)
//       }
//       await TrackPlayer.play()
//     })
// }

// export const useNext = () => {
//   return () =>
//     rntpCommands.enqueue(async () => {
//       const [current, queue] = await Promise.all([await TrackPlayer.getCurrentTrack(), await getQueue()])
//       if (current >= queue.length - 1) {
//         await TrackPlayer.skip(0)
//         await TrackPlayer.pause()
//       } else {
//         await TrackPlayer.skipToNext()
//         await TrackPlayer.play()
//       }
//     })
// }

// export const useSkipTo = () => {
//   return (track: number) =>
//     rntpCommands.enqueue(async () => {
//       const queue = await getQueue()
//       if (track < 0 || track >= queue.length) {
//         return
//       }
//       await TrackPlayer.skip(track)
//       await TrackPlayer.play()
//     })
// }

// export const useSeekTo = () => {
//   return (position: number) =>
//     rntpCommands.enqueue(async () => {
//       await TrackPlayer.seekTo(position)
//     })
// }

// export const useReset = (enqueue = true) => {
//   const resetStore = useStore(store => store.reset)

//   const reset = async () => {
//     await TrackPlayer.reset()
//     resetStore()
//   }

//   return enqueue ? () => rntpCommands.enqueue(reset) : reset
// }

export const useIsPlaying = (contextId: string | undefined, track: number) => {
  const currentContextId = useStore(store => store.session?.contextId)
  const currentIdx = useStore(store => store.session?.currentIdx)
  const shuffleOrder = useStoreDeep(store => store.session?.shuffleOrder)

  if (contextId === undefined) {
    return track === currentIdx
  }

  if (shuffleOrder) {
    const shuffledTrack = shuffleOrder.findIndex(i => i === track)
    track = shuffledTrack !== undefined ? shuffledTrack : -1
  }

  return contextId === currentContextId && track === currentIdx
}

export function mapSongToTrackExt(song: Song): TrackExt {
  return {
    id: song.id,
    idx: 0,
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

export const useSetQueue = (type: QueueType, songs?: Song[]) => {
  const createSession = useStore(store => store.createSession)

  const contextId = `${type}-${songs?.map(s => s.id).join('-')}`

  const setQueue = async (options: SetQueueOptions) => {
    if (!songs || songs.length === 0) {
      return
    }

    const queue = songs.map(mapSongToTrackExt)
    const first = queue[options.playTrack || 0]

    if (!first.albumId) {
      first.artwork = require('@res/fallback.png')
    } else {
      const albumCoverArt = queryClient.getQueryData<string>(qk.albumCoverArt(first.albumId))
      const existingFile = queryClient.getQueryData<string>(qk.existingFiles('coverArtThumb', albumCoverArt))
      const downloadFile = queryClient.getQueryData<string>(qk.coverArt(albumCoverArt, 'thumbnail'))
      if (existingFile || downloadFile) {
        first.artwork = `file://${existingFile || downloadFile}`
      }
    }

    await createSession({
      queue: songs,
      title: options.title,
      type,
      contextId,
      playIdx: options.playTrack,
      shuffle: options.shuffle,
    })
    // await _setQueue({ queue, type, contextId, ...options })
    // QueueEvents.emit('set', { queue })
  }

  return { setQueue, contextId }
}
