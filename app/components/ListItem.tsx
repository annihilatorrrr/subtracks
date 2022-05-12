import { useIsPlaying } from '@app/hooks/trackplayer'
import { Album, Artist, Playlist, Song, StarrableItemType } from '@app/models/library'
import { useStore, useStoreDeep } from '@app/state/store'
import colors from '@app/styles/colors'
import font from '@app/styles/font'
import { useNavigation } from '@react-navigation/native'
import equal from 'fast-deep-equal/es6/react'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatListProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import * as Progress from 'react-native-progress'
import IconFA from 'react-native-vector-icons/FontAwesome'
import IconFA5 from 'react-native-vector-icons/FontAwesome5'
import IconMat from 'react-native-vector-icons/MaterialIcons'
import { AlbumContextPressable, ArtistContextPressable, SongContextPressable } from './ContextMenu'
import CoverArt, { AlbumIdImageProps, ArtistImageProps, CoverArtImageProps } from './CoverArt'
import PressableOpacity from './PressableOpacity'
import { PressableStar } from './Star'
import { useMMKVString } from 'react-native-mmkv'
import qk from '@app/query/queryKeys'
import { storage, stringifyKey } from '@app/query/downloadCache'

const ItemTextTitleSong = React.memo<
  SizeProp & {
    contextId?: string
    queueId: number
    title?: string
  }
>(({ size, contextId, queueId, title }) => {
  const playing = useIsPlaying(contextId, queueId)
  const sizeStyle = useSizeStyle(size)

  const titleStyle: StyleProp<TextStyle> = [styles.titleText, sizeStyle.titleText]
  if (playing) {
    titleStyle.push(styles.titlePlaying)
  }

  return (
    <ItemTextLineWrapper>
      {playing && (
        <ItemTextLineIconWrapper>
          <IconFA5 name="play" size={9} color={colors.accent} style={styles.playingIcon} />
        </ItemTextLineIconWrapper>
      )}
      <Text numberOfLines={1} style={titleStyle}>
        {title}
      </Text>
    </ItemTextLineWrapper>
  )
})

const ItemTextTitle = React.memo<
  SizeProp & {
    title?: string
  }
>(({ size, title }) => {
  const sizeStyle = useSizeStyle(size)
  return (
    <ItemTextLineWrapper>
      <Text numberOfLines={1} style={[styles.titleText, sizeStyle.titleText]}>
        {title}
      </Text>
    </ItemTextLineWrapper>
  )
})

const ItemTextSubtitle = React.memo<
  SizeProp & {
    subtitle?: string
  }
>(({ size, subtitle }) => {
  const sizeStyle = useSizeStyle(size)
  return (
    <Text numberOfLines={1} style={[styles.subtitle, sizeStyle.subtitle]}>
      {subtitle}
    </Text>
  )
})

const ItemTextWrapper: React.FC = ({ children }) => <View style={styles.text}>{children}</View>

const ItemTextLineWrapper: React.FC = ({ children }) => <View style={styles.textLine}>{children}</View>

const ItemTextLineIconWrapper: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return <View style={styles.textLineIcon}>{children}</View>
}

const ItemText = React.memo<
  SizeProp & {
    title?: string
    subtitle?: string
  }
>(({ size, title, subtitle }) => (
  <ItemTextWrapper>
    <ItemTextTitle title={title} size={size} />
    {!!subtitle && (
      <ItemTextLineWrapper>
        <ItemTextSubtitle subtitle={subtitle} size={size} />
      </ItemTextLineWrapper>
    )}
  </ItemTextWrapper>
))

const ItemControls = React.memo<{
  id: string
  type: StarrableItemType
}>(props => (
  <View style={styles.controls}>
    <PressableStar {...props} size={26} style={styles.controlItem} />
  </View>
))

type SizeProp = { size?: 'small' | 'big' }
type OnPressProp = { onPress?: () => void }

type AlbumProp = { album: Album }
type ArtistProp = { artist: Artist }
type PlaylistProp = { playlist: Playlist }

type SongProp = { song: Song }
type SongProps = SongProp & {
  queueId: number
  contextId?: string
  subtitle?: 'album' | 'artist' | 'artist-album'
}

type ListItemProps = SizeProp & {
  onPress?: () => void
  showArt?: boolean
  showStar?: boolean
  style?: StyleProp<ViewStyle>
}

const AlbumItemPressable: React.FC<AlbumProp & OnPressProp> = ({ children, album, onPress }) => {
  const navigation = useNavigation()
  onPress = onPress || (() => navigation.navigate('album', { id: album.id, title: album.name, album }))

  return (
    <AlbumContextPressable album={album} onPress={onPress} triggerWrapperStyle={styles.item}>
      {children}
    </AlbumContextPressable>
  )
}

const ArtistItemPressable: React.FC<ArtistProp & OnPressProp> = ({ children, artist, onPress }) => {
  const navigation = useNavigation()
  onPress = onPress || (() => navigation.navigate('artist', { id: artist.id, title: artist.name, artist }))

  return (
    <ArtistContextPressable artist={artist} onPress={onPress} triggerWrapperStyle={styles.item}>
      {children}
    </ArtistContextPressable>
  )
}

const PlaylistItemPressable: React.FC<PlaylistProp & OnPressProp> = ({ children, playlist, onPress }) => {
  const navigation = useNavigation()
  onPress = onPress || (() => navigation.navigate('playlist', { id: playlist.id, title: playlist.name, playlist }))

  return (
    <PressableOpacity onPress={onPress} style={styles.item}>
      {children}
    </PressableOpacity>
  )
}

const SongItemPressable: React.FC<SongProp & OnPressProp> = ({ children, song, onPress }) => {
  return (
    <SongContextPressable song={song} onPress={onPress} triggerWrapperStyle={styles.item}>
      {children}
    </SongContextPressable>
  )
}

const ItemWrapper: React.FC<
  SizeProp & {
    style?: StyleProp<ViewStyle>
  }
> = ({ children, size, style }) => {
  const sizeStyle = useSizeStyle(size)
  return <View style={[styles.container, sizeStyle.container, style]}>{children}</View>
}

type ListItemCoverArtProps =
  | (Omit<CoverArtImageProps, 'size'> & Required<SizeProp>)
  | (Omit<AlbumIdImageProps, 'size'> & Required<SizeProp>)
  | (Omit<ArtistImageProps, 'size'> & Required<SizeProp>)

const ItemCoverArt = React.memo<ListItemCoverArtProps>(props => {
  const sizeStyle = useSizeStyle(props.size)
  return <CoverArt {...props} style={{ ...styles.art, ...sizeStyle.art }} resizeMode="cover" size="thumbnail" />
})

const useDefaultProps: <T extends ListItemProps>(props: T) => T & Required<Pick<T, 'size' | 'showStar'>> = props => {
  return {
    ...props,
    size: props.size === undefined ? 'small' : 'big',
    showStar: props.showStar === undefined ? true : props.showStar,
  }
}

export const AlbumListItem = React.memo<ListItemProps & AlbumProp>(props => {
  const { album, onPress, showArt, showStar, size, style } = useDefaultProps(props)

  return (
    <ItemWrapper size={size} style={style}>
      <AlbumItemPressable album={album} onPress={onPress}>
        {showArt && <ItemCoverArt type="cover" coverArt={album.coverArt} size={size} />}
        <ItemText title={album.name} subtitle={album.artist} size={size} />
      </AlbumItemPressable>
      {showStar && <ItemControls id={album.id} type="album" />}
    </ItemWrapper>
  )
}, equal)

export const ArtistListItem = React.memo<ListItemProps & ArtistProp>(props => {
  const { artist, onPress, showArt, showStar, size, style } = useDefaultProps(props)

  return (
    <ItemWrapper size={size} style={style}>
      <ArtistItemPressable artist={artist} onPress={onPress}>
        {showArt && <ItemCoverArt type="artist" artistId={artist.id} size={size} round={true} />}
        <ItemText title={artist.name} size={size} />
      </ArtistItemPressable>
      {showStar && <ItemControls id={artist.id} type="artist" />}
    </ItemWrapper>
  )
}, equal)

export const PlaylistListItem = React.memo<Omit<ListItemProps, 'showStar'> & PlaylistProp>(props => {
  const { playlist, onPress, showArt, size, style } = useDefaultProps(props)

  return (
    <ItemWrapper size={size} style={style}>
      <PlaylistItemPressable playlist={playlist} onPress={onPress}>
        {showArt && <ItemCoverArt type="cover" coverArt={playlist.coverArt} size={size} />}
        <ItemText title={playlist.name} subtitle={playlist.comment} size={size} />
      </PlaylistItemPressable>
    </ItemWrapper>
  )
}, equal)

const useSongDownload = (id: string) => {
  const download = useStore(store => () => store.downloadSong(id))
  const serverId = useStore(store => store.settings.activeServerId)
  const job = useStoreDeep(store => (serverId ? store.downloads[serverId]?.byId[id] : undefined))
  // const songPath = useStore(store => (serverId ? store.downloads[serverId]?.songs[id]?.path : undefined))
  const [songPath] = useMMKVString(stringifyKey(qk.songPath(id)), serverId ? storage(serverId) : undefined)
  const isFetching = useStore(store => {
    if (!serverId) {
      return false
    }

    const downloads = store.downloads[serverId]
    if (!downloads) {
      return false
    }

    if (downloads.allIds.length > 0) {
      return downloads.allIds[0] === id
    }
    return false
  })
  const isPending = useStore(store => {
    if (!serverId) {
      return false
    }

    const downloads = store.downloads[serverId]
    if (!downloads) {
      return false
    }

    if (downloads.allIds.length > 0) {
      return downloads.allIds.indexOf(id) > 0
    }
    return false
  })
  const [progress, setProgress] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (job?.received === undefined || job?.total === undefined) {
      return
    }

    const newProgress = job.total > 0 ? job.received / job.total : 0
    if (progress === undefined || newProgress > progress) {
      setProgress(newProgress)
    }
  }, [id, job?.received, job?.total, progress])

  return { download, progress, isFetching, isPending, songPath }
}

export const SongListItem = React.memo<ListItemProps & SongProps>(props => {
  const { song, contextId, queueId, onPress, showArt, showStar, size, style, subtitle } = useDefaultProps(props)
  const { songPath, download, isFetching, isPending, progress } = useSongDownload(song.id)

  let subtitleText = song.artist || song.album || song.title
  if ((subtitle === 'album' || subtitle === 'artist') && song[subtitle]) {
    subtitleText = song[subtitle]!
  } else if (subtitle === 'artist-album' && song.artist && song.album) {
    subtitleText = `${song.artist} • ${song.album}`
  }

  return (
    <ItemWrapper size={size} style={style}>
      <SongItemPressable song={song} onPress={onPress}>
        {showArt && <ItemCoverArt type="album" albumId={song.albumId} size={size} />}
        <ItemTextWrapper>
          <ItemTextTitleSong contextId={contextId} queueId={queueId} title={song.title} size={size} />
          <ItemTextLineWrapper>
            {/* <ItemTextLineIconWrapper>
              <Progress.Pie
                size={13}
                borderWidth={1}
                style={styles.iconProgress}
                color={colors.text.secondary}
                progress={progress}
              />
            </ItemTextLineIconWrapper>
            <ItemTextLineIconWrapper>
              <ActivityIndicator size={14} color={colors.text.secondary} style={styles.iconDownloading} />
            </ItemTextLineIconWrapper>
            <ItemTextLineIconWrapper>
              <IconMat name="file-download" size={15} color={colors.text.secondary} style={styles.iconPending} />
            </ItemTextLineIconWrapper>
            <ItemTextLineIconWrapper>
              <IconMat
                name="file-download-done"
                size={15}
                color={colors.text.secondary}
                style={styles.iconDownloaded}
              />
            </ItemTextLineIconWrapper> */}
            {isFetching &&
              (progress !== undefined ? (
                <ItemTextLineIconWrapper>
                  <Progress.Pie
                    size={12}
                    borderWidth={1}
                    style={styles.iconProgress}
                    color={colors.text.secondary}
                    progress={progress}
                  />
                </ItemTextLineIconWrapper>
              ) : (
                <ItemTextLineIconWrapper>
                  <ActivityIndicator size={14} color={colors.text.secondary} style={styles.iconDownloading} />
                </ItemTextLineIconWrapper>
              ))}
            {isPending && !isFetching && (
              <ItemTextLineIconWrapper>
                <IconMat name="file-download" size={15} color={colors.text.secondary} style={styles.iconPending} />
              </ItemTextLineIconWrapper>
            )}
            {!!songPath && (
              <ItemTextLineIconWrapper>
                <IconMat
                  name="file-download-done"
                  size={15}
                  color={colors.text.secondary}
                  style={styles.iconDownloaded}
                />
              </ItemTextLineIconWrapper>
            )}
            <ItemTextSubtitle subtitle={subtitleText} size={size} />
          </ItemTextLineWrapper>
        </ItemTextWrapper>
      </SongItemPressable>
      {showStar && <ItemControls id={song.id} type="song" />}
      <View style={styles.controls}>
        <PressableOpacity onPress={() => download()} style={styles.controlItem}>
          <IconFA name="download" color={colors.text.secondary} size={26} />
        </PressableOpacity>
      </View>
    </ItemWrapper>
  )
}, equal)

export class ListItemSize {
  size: number
  marginBottom: number

  constructor(size: number, marginBottom: number) {
    this.size = size
    this.marginBottom = marginBottom
  }

  get height(): number {
    return this.size + this.marginBottom
  }

  getItemLayout: FlatListProps<any>['getItemLayout'] = (data, index) => {
    return { length: this.height, offset: this.height * index, index }
  }
}

export const LIST_ITEM_SMALL = new ListItemSize(50, 10)
export const LIST_ITEM_BIG = new ListItemSize(70, 12)

function createSizeStyle(size: 'big' | 'small') {
  const opt = size === 'big' ? LIST_ITEM_BIG : LIST_ITEM_SMALL

  return StyleSheet.create({
    container: {
      height: opt.size,
      marginBottom: opt.marginBottom,
    },
    art: {
      height: opt.size,
      width: opt.size,
      marginRight: size === 'small' ? 10 : 14,
    },
    titleText: {
      fontSize: size === 'small' ? 15 : 17,
      fontFamily: size === 'small' ? font.medium : font.semiBold,
    },
    subtitle: {
      fontSize: size === 'small' ? 14 : 16,
      fontFamily: size === 'small' ? font.regular : font.medium,
    },
  })
}

const smallStyles = createSizeStyle('small')
const bigStyles = createSizeStyle('big')

const useSizeStyle = (size: 'small' | 'big' | undefined) => {
  return size === 'big' ? bigStyles : smallStyles
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  art: {},
  text: {
    flex: 1,
  },
  textLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  titleText: {
    flex: 1,
    color: colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  subtitle: {
    flex: 1,
    color: colors.text.secondary,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  titlePlaying: {
    fontFamily: font.semiBold,
    color: colors.accent,
  },
  playingIcon: {
    paddingBottom: 1,
    paddingLeft: 2,
  },
  textLineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 16,
  },
  iconProgress: {
    marginLeft: 0,
  },
  iconDownloading: {
    marginLeft: 0,
  },
  iconPending: {
    marginLeft: -2,
  },
  iconDownloaded: {
    marginLeft: -1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlItem: {
    marginLeft: 16,
  },
})
