import { useStore } from '@app/state/store'
import React, { useEffect, useState } from 'react'
import { useProgress } from 'react-native-track-player'

const ProgressHook = () => {
  const holdProgress = useStore(store => store.session?.holdProgress)
  const setProgress = useStore(store => store.setProgress)
  const releaseProgressHold = useStore(store => store.releaseProgressHold)
  const { buffered, duration, position } = useProgress(250)
  const [pause, setPause] = useState(false)

  useEffect(() => {
    if (holdProgress === undefined) {
      return
    }

    if (holdProgress && !pause) {
      setPause(true)
      setTimeout(() => {
        releaseProgressHold()
        setPause(false)
      }, 501)
      return
    } else if (holdProgress || pause) {
      return
    }

    setProgress({
      buffered: Math.max(0, buffered),
      duration: Math.max(0, duration),
      position: Math.max(0, position),
    })
  }, [setProgress, buffered, duration, position, holdProgress, pause, releaseProgressHold])

  return <></>
}

export default ProgressHook
