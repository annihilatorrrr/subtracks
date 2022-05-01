import { EmitterSubscription, NativeEventEmitter } from 'react-native'
import { TrackExt } from '@app/models/trackplayer'

export interface IQueueEventEmitter extends NativeEventEmitter {
  emit(eventType: 'session'): void
  addListener(eventType: 'session', listener: () => void): EmitterSubscription

  emit(eventType: 'set', event: { queue: TrackExt[] }): void
  addListener(eventType: 'set', listener: (event: { queue: TrackExt[] }) => void): EmitterSubscription
}

class QueueEventEmitter extends NativeEventEmitter {}

const QueueEvents: IQueueEventEmitter = new QueueEventEmitter()
export default QueueEvents
