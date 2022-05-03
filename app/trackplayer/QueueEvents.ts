import { EmitterSubscription, NativeEventEmitter } from 'react-native'

export interface IQueueEventEmitter extends NativeEventEmitter {
  emit(eventType: 'session-created'): void
  addListener(eventType: 'session-created', listener: (event?: never) => void): EmitterSubscription
}

class QueueEventEmitter extends NativeEventEmitter {}

const QueueEvents: IQueueEventEmitter = new QueueEventEmitter()
export default QueueEvents
