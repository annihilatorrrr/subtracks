import CoverArt from '@app/components/CoverArt'
import HeaderBar from '@app/components/HeaderBar'
import GradientImageBackground from '@app/components/GradientImageBackground'
import PressableOpacity from '@app/components/PressableOpacity'
import { PressableStar } from '@app/components/Star'
import { withSuspenseMemo } from '@app/components/withSuspense'
import { useStore, useStoreDeep } from '@app/state/store'
import colors from '@app/styles/colors'
import font from '@app/styles/font'
import formatDuration from '@app/util/formatDuration'
import Slider from '@react-native-community/slider'
import { useNavigation } from '@react-navigation/native'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, TextStyle, View } from 'react-native'
import { NativeStackScreenProps } from 'react-native-screens/native-stack'
import { RepeatMode, State } from 'react-native-track-player'
import IconFA from 'react-native-vector-icons/FontAwesome'
import IconFA5 from 'react-native-vector-icons/FontAwesome5'
import Icon from 'react-native-vector-icons/Ionicons'
import IconMatCom from 'react-native-vector-icons/MaterialCommunityIcons'
import { Song } from '@app/models/library'
import { useQueryAlbumCoverArtPath } from '@app/hooks/query'

const NowPlayingHeader = withSuspenseMemo<{
  song?: Song
}>(({ song }) => {
  const title = useStore(store => store.session?.title)
  const type = useStore(store => store.session?.type)
  const { t } = useTranslation()

  console.log(t('resources.album.name', { count: 1 }))

  if (!song) {
    return <></>
  }

  let contextName: string
  if (type === 'album') {
    contextName = t('resources.album.name', { count: 1 })
  } else if (type === 'artist') {
    contextName = t('resources.song.lists.artistTopSongs')
  } else if (type === 'playlist') {
    contextName = t('resources.playlist.name', { count: 1 })
  } else if (type === 'song') {
    contextName = t('search.nowPlayingContext')
  }

  return (
    <HeaderBar
      headerStyle={headerStyles.bar}
      contextItem={song}
      HeaderCenter={() => (
        <View style={headerStyles.center}>
          {contextName !== undefined && (
            <Text numberOfLines={1} style={headerStyles.queueType}>
              {contextName}
            </Text>
          )}
          <Text numberOfLines={1} style={headerStyles.queueName}>
            {title || 'Nothing playing...'}
          </Text>
        </View>
      )}
    />
  )
})

const headerStyles = StyleSheet.create({
  bar: {
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  queueType: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
  },
  queueName: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text.primary,
    textAlign: 'center',
  },
})

const SongCoverArt = () => {
  const albumId = useStore(store => store.session?.current.albumId)

  return (
    <View style={coverArtStyles.container}>
      <CoverArt type="album" size="original" albumId={albumId} style={coverArtStyles.image} />
    </View>
  )
}

const coverArtStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    marginTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 15,
  },
  image: {
    height: '100%',
    width: '100%',
  },
})

const SongInfo = () => {
  const id = useStore(store => store.session?.current.id)
  const artist = useStore(store => store.session?.current.artist)
  const title = useStore(store => store.session?.current.title)

  return (
    <View style={infoStyles.container}>
      <View style={infoStyles.details}>
        <Text numberOfLines={1} style={infoStyles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={infoStyles.artist}>
          {artist}
        </Text>
      </View>
      <View style={infoStyles.controls}>
        <PressableStar id={id || '-1'} type={'song'} size={32} />
      </View>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginTop: 15,
  },
  details: {
    flex: 1,
    marginRight: 20,
  },
  controls: {
    justifyContent: 'center',
  },
  title: {
    minHeight: 30,
    fontFamily: font.bold,
    fontSize: 22,
    color: colors.text.primary,
  },
  artist: {
    minHeight: 21,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text.secondary,
  },
})

const SeekBar = () => {
  const progress = useStoreDeep(store => store.session?.progress)
  const holdProgress = useStoreDeep(store => store.session?.holdProgress)
  const seekTo = useStore(store => store.seek)
  const [value, setValue] = useState(0)
  const [slideToValue, setSlideToValue] = useState(0)
  const [sliding, setSliding] = useState(false)

  useEffect(() => {
    if (sliding || progress?.position === undefined || holdProgress === true) {
      return
    }

    setValue(progress.position)
  }, [holdProgress, progress?.position, sliding])

  const onSlidingStart = useCallback(() => {
    setSliding(true)
  }, [])

  const onSlidingComplete = useCallback(
    async (val: number) => {
      setValue(val)
      await seekTo(val)
      setSliding(false)
    },
    [seekTo],
  )

  const onValueChange = useCallback((val: number) => {
    setSlideToValue(val)
  }, [])

  if (!progress) {
    return <></>
  }

  return (
    <View style={seekStyles.container}>
      <View style={seekStyles.barContainer}>
        <Slider
          style={seekStyles.slider}
          minimumTrackTintColor="white"
          maximumTrackTintColor={colors.text.secondary}
          thumbTintColor="white"
          maximumValue={progress.duration}
          value={value}
          onSlidingStart={onSlidingStart}
          onSlidingComplete={onSlidingComplete}
          onValueChange={onValueChange}
        />
      </View>
      <View style={seekStyles.textContainer}>
        <Text style={seekStyles.text}>{formatDuration(sliding ? slideToValue : value)}</Text>
        <Text style={seekStyles.text}>{formatDuration(progress.duration)}</Text>
      </View>
    </View>
  )
}

const seekStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 15,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  bars: {
    backgroundColor: colors.text.primary,
    height: 4,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  barLeft: {
    marginRight: -6,
  },
  barRight: {
    opacity: 0.3,
    marginLeft: -6,
  },
  indicator: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: colors.text.primary,
    elevation: 1,
  },
  textContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  text: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
})

const PlayerControls = () => {
  const state = useStore(store => store.session?.playerState)
  const play = useStore(store => store.play)
  const pause = useStore(store => store.pause)
  const next = useStore(store => store.next)
  const previous = useStore(store => store.previous)
  const shuffled = useStore(store => !!store.session?.shuffleOrder)
  const toggleShuffle = useStore(store => store.toggleShuffle)
  const repeatMode = useStore(store => store.repeatMode)
  const toggleRepeat = useStore(store => store.toggleRepeatMode)
  const navigation = useNavigation()

  let playPauseIcon: string
  let playPauseAction: undefined | (() => void)
  let disabled: boolean

  switch (state) {
    case State.Playing:
      disabled = false
      playPauseIcon = 'pause-circle'
      playPauseAction = pause
      break
    case State.Buffering:
      disabled = false
      playPauseIcon = 'circle'
      playPauseAction = pause
      break
    default:
      disabled = false
      playPauseIcon = 'play-circle'
      playPauseAction = play
      break
  }

  const repeatExtOpacity: TextStyle = {
    opacity: repeatMode === RepeatMode.Track ? 1 : 0,
  }

  return (
    <View style={controlsStyles.container}>
      <View style={controlsStyles.top}>
        <View style={controlsStyles.center}>
          <PressableOpacity onPress={() => toggleRepeat()} disabled={disabled} hitSlop={16}>
            <Icon name="repeat" size={26} color={repeatMode === RepeatMode.Off ? 'white' : colors.accent} />
            <Text style={[controlsStyles.repeatExt, repeatExtOpacity]}>1</Text>
          </PressableOpacity>
        </View>

        <View style={controlsStyles.center}>
          <PressableOpacity onPress={previous} disabled={disabled}>
            <IconFA5 name="step-backward" size={36} color="white" />
          </PressableOpacity>
          <PressableOpacity onPress={playPauseAction} disabled={disabled} style={controlsStyles.play}>
            <IconFA name={playPauseIcon} size={82} color="white" />
            {state === State.Buffering && (
              <ActivityIndicator
                style={controlsStyles.buffering}
                color={colors.gradient.low}
                size="large"
                animating={true}
              />
            )}
          </PressableOpacity>
          <PressableOpacity onPress={next} disabled={disabled}>
            <IconFA5 name="step-forward" size={36} color="white" />
          </PressableOpacity>
        </View>

        <View style={controlsStyles.center}>
          <PressableOpacity onPress={() => toggleShuffle()} disabled={disabled} hitSlop={16}>
            <Icon name="shuffle" size={26} color={shuffled ? colors.accent : 'white'} />
          </PressableOpacity>
        </View>
      </View>
      <View style={controlsStyles.bottom}>
        {/* <PressableOpacity onPress={undefined} disabled={true} hitSlop={16}>
          <IconMatCom name="cast-audio" size={20} color="white" />
        </PressableOpacity> */}
        <PressableOpacity onPress={() => navigation.navigate('queue')} disabled={disabled} hitSlop={16}>
          <IconMatCom name="playlist-play" size={24} color="white" />
        </PressableOpacity>
      </View>
    </View>
  )
}

const controlsStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 10,
    paddingBottom: 40,
  },
  play: {
    marginHorizontal: 30,
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatExt: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: 14,
    position: 'absolute',
    top: 26,
  },
  buffering: {
    position: 'absolute',
  },
})

type RootStackParamList = {
  top: undefined
  main: undefined
}
type NowPlayingProps = NativeStackScreenProps<RootStackParamList, 'main'>

const NowPlayingView: React.FC<NowPlayingProps> = ({ navigation }) => {
  const song = useStoreDeep(store => store.session?.current)
  const { data } = useQueryAlbumCoverArtPath(song?.albumId, 'thumbnail')

  useEffect(() => {
    if (!song) {
      navigation.navigate('top')
    }
  })

  const imagePath = typeof data === 'string' ? data.replace('file://', '') : undefined

  if (!song) {
    return <></>
  }

  return (
    <View style={styles.container}>
      <GradientImageBackground imagePath={imagePath} height={'100%'} />
      <NowPlayingHeader song={song} />
      <View style={styles.content}>
        <SongCoverArt />
        <SongInfo />
        <SeekBar />
        <PlayerControls />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
  },
})

export default NowPlayingView
