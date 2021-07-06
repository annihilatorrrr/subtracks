import { useAtomValue } from 'jotai/utils'
import React from 'react'
import { StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import TrackPlayer, { State } from 'react-native-track-player'
import {
  queueNameAtom,
  currentTrackAtom,
  playerStateAtom,
  useNext,
  usePrevious,
  useProgress,
} from '../state/trackplayer'
import colors from '../styles/colors'
import text, { Font } from '../styles/text'
import { formatDuration } from '../util'
import CoverArt from './common/CoverArt'
import ImageGradientBackground from './common/ImageGradientBackground'
import PressableImage from './common/PressableImage'

const NowPlayingHeader = () => {
  const queueName = useAtomValue(queueNameAtom)

  return (
    <View style={headerStyles.container}>
      <FastImage source={require('../../res/arrow_left-fill.png')} style={headerStyles.icons} tintColor="white" />
      <Text numberOfLines={2} style={headerStyles.queueName}>
        {queueName || 'Nothing playing...'}
      </Text>
      <FastImage source={require('../../res/more_vertical.png')} style={headerStyles.icons} tintColor="white" />
    </View>
  )
}

const headerStyles = StyleSheet.create({
  container: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor: 'green',
  },
  icons: {
    height: 22,
    width: 22,
    margin: 17,
  },
  queueName: {
    ...text.paragraph,
  },
})

const SongCoverArt = () => {
  const track = useAtomValue(currentTrackAtom)
  const layout = useWindowDimensions()

  const size = layout.width - layout.width / 7

  return (
    <View style={coverArtStyles.container}>
      <CoverArt
        PlaceholderComponent={() => <View style={{ height: size, width: size }} />}
        height={size}
        width={size}
        coverArtUri={track?.artwork as string}
      />
    </View>
  )
}

const coverArtStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
})

const SongInfo = () => {
  const track = useAtomValue(currentTrackAtom)

  return (
    <View style={infoStyles.container}>
      <Text style={infoStyles.title}>{track?.title}</Text>
      <Text style={infoStyles.artist}>{track?.artist}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    ...text.songListTitle,
    fontSize: 22,
    textAlign: 'center',
  },
  artist: {
    ...text.songListSubtitle,
    fontSize: 14,
    textAlign: 'center',
  },
})

const SeekBar = () => {
  const { position, duration } = useProgress()

  let progress = 0
  if (duration > 0) {
    progress = position / duration
  }

  return (
    <View style={seekStyles.container}>
      <View style={seekStyles.barContainer}>
        <View style={{ ...seekStyles.bars, ...seekStyles.barLeft, flex: progress }} />
        <View style={{ ...seekStyles.indicator, opacity: progress ? 1 : 0 }} />
        <View style={{ ...seekStyles.bars, ...seekStyles.barRight, flex: 1 - progress }} />
      </View>
      <View style={seekStyles.textContainer}>
        <Text style={seekStyles.text}>{formatDuration(position)}</Text>
        <Text style={seekStyles.text}>{formatDuration(duration)}</Text>
      </View>
    </View>
  )
}

const seekStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bars: {
    backgroundColor: colors.text.primary,
    height: 4,
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
  },
  text: {
    fontFamily: Font.regular,
    fontSize: 15,
    color: colors.text.primary,
  },
})

const PlayerControls = () => {
  const state = useAtomValue(playerStateAtom)
  const next = useNext()
  const previous = usePrevious()

  let playPauseIcon: number
  let playPauseAction: undefined | (() => void)
  let disabled: boolean

  switch (state) {
    case State.Playing:
    case State.Buffering:
    case State.Connecting:
      disabled = false
      playPauseIcon = require('../../res/pause_circle-fill.png')
      playPauseAction = () => TrackPlayer.pause()
      break
    case State.Paused:
      disabled = false
      playPauseIcon = require('../../res/play_circle-fill.png')
      playPauseAction = () => TrackPlayer.play()
      break
    default:
      disabled = true
      playPauseIcon = require('../../res/play_circle-fill.png')
      playPauseAction = undefined
      break
  }

  return (
    <View style={controlsStyles.container}>
      <PressableImage
        onPress={disabled ? undefined : previous}
        source={require('../../res/previous-fill.png')}
        style={controlsStyles.skip}
        disabled={disabled}
      />
      <PressableImage
        onPress={playPauseAction}
        source={playPauseIcon}
        style={controlsStyles.play}
        disabled={disabled}
      />
      <PressableImage
        onPress={disabled ? undefined : next}
        source={require('../../res/next-fill.png')}
        style={controlsStyles.skip}
        disabled={disabled}
      />
    </View>
  )
}

const controlsStyles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  skip: {
    height: 40,
    width: 40,
    marginHorizontal: 18,
  },
  play: {
    height: 90,
    width: 90,
  },
})

const NowPlayingLayout = () => {
  const track = useAtomValue(currentTrackAtom)

  return (
    <View
      style={{
        flex: 1,
        paddingTop: StatusBar.currentHeight,
      }}>
      <ImageGradientBackground imageUri={track?.artworkThumb as string} imageKey={`${track?.album}${track?.artist}`} />
      <NowPlayingHeader />
      <SongCoverArt />
      <SongInfo />
      <SeekBar />
      <PlayerControls />
    </View>
  )
}

export default NowPlayingLayout
