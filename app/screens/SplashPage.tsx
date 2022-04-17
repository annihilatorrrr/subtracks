import React, { useCallback, useEffect, useState } from 'react'
import { Image, View, StyleSheet, Text, unstable_batchedUpdates } from 'react-native'
import { useStore } from '@app/state/store'
import colors from '@app/styles/colors'
import GradientBackground from '@app/components/GradientBackground'
import font from '@app/styles/font'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import TrackPlayer, { Capability } from 'react-native-track-player'
import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo'

function getNetState(netStateType: NetInfoStateType): 'mobile' | 'wifi' {
  switch (netStateType) {
    case NetInfoStateType.cellular:
    case NetInfoStateType.none:
    case NetInfoStateType.other:
    case NetInfoStateType.unknown:
      return 'mobile'
    default:
      return 'wifi'
  }
}

const setNetState = (netState: 'mobile' | 'wifi') => {
  unstable_batchedUpdates(() => {
    useStore.getState().setNetState(netState)
  })
}

const SplashPage: React.FC<{}> = ({ children }) => {
  const hydrated = useStore(store => store.hydrated)
  const [ready, setReady] = useState(false)
  const opacity = useSharedValue(0)

  const animatedStyles = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    }
  })

  const minSplashTime = new Promise(resolve => setTimeout(resolve, 1000))

  const prepare = useCallback(async () => {
    try {
      await TrackPlayer.setupPlayer()
    } catch {
      return
    } finally {
      try {
        const state = await NetInfo.fetch()
        setNetState(getNetState(state.type))
      } catch {}
    }

    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play, //
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      playIcon: require('@res/icons/notification/ic_stat_play.png'),
      pauseIcon: require('@res/icons/notification/ic_stat_pause.png'),
      stopIcon: require('@res/icons/notification/ic_stat_stop.png'),
      nextIcon: require('@res/icons/notification/ic_stat_next.png'),
      previousIcon: require('@res/icons/notification/ic_stat_previous.png'),
      icon: require('@res/icons/notification/ic_stat_play.png'),
    })

    NetInfo.addEventListener(state => {
      setNetState(getNetState(state.type))
    })
  }, [])

  useEffect(() => {
    const promise = Promise.all([prepare(), minSplashTime])

    opacity.value = withTiming(1, {
      duration: 200,
    })

    promise
      .then(() => {
        setReady(true)
      })
      .then(() => {
        opacity.value = withTiming(0, {
          duration: 500,
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const splash = (
    <Animated.View style={[styles.splashContainer, animatedStyles]} pointerEvents="none">
      <GradientBackground style={styles.background} height="100%">
        <View style={styles.logoContainer}>
          <Image style={styles.image} source={require('@res/casette.png')} fadeDuration={0} />
          <Text style={styles.text}>subtracks</Text>
        </View>
      </GradientBackground>
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      {ready && hydrated && children}
      {splash}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  splashContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
  background: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    height: 150,
    width: 150,
    marginBottom: -10,
    tintColor: colors.accent,
  },
  text: {
    fontFamily: font.bold,
    fontSize: 31,
    color: colors.text.primary,
  },
})

export default SplashPage
