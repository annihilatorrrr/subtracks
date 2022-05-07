import { useQuerySongPath } from '@app/hooks/query'
import { useIsPlaying } from '@app/hooks/trackplayer'
import { Album, Artist, Playlist, Song, StarrableItemType } from '@app/models/library'
import colors from '@app/styles/colors'
import { listItemDefault } from '@app/styles/dimensions'
import font from '@app/styles/font'
import { useNavigation } from '@react-navigation/native'
import equal from 'fast-deep-equal/es6/react'
import React from 'react'
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import * as Progress from 'react-native-progress'
import IconFA5 from 'react-native-vector-icons/FontAwesome5'
import IconMat from 'react-native-vector-icons/MaterialIcons'
import { AlbumContextPressable, ArtistContextPressable, SongContextPressable } from './ContextMenu'
import CoverArt, { AlbumIdImageProps, ArtistImageProps, CoverArtImageProps } from './CoverArt'
import PressableOpacity from './PressableOpacity'
import { PressableStar } from './Star'

// const ListItem: React.FC<{
//   item: ListableItem
//   contextId?: string
//   queueId?: number
//   onPress?: () => void
//   showArt?: boolean
//   showStar?: boolean
//   listStyle?: 'big' | 'small'
//   subtitle?: string
//   style?: StyleProp<ViewStyle>
//   disabled?: boolean
// }> = ({ item, contextId, queueId, onPress, showArt, showStar, subtitle, listStyle, style, disabled }) => {
//   const navigation = useNavigation()
//   const { data: songPath, setEnableDownload, isFetching, progress } = useQuerySongPath(item.id)

//   showStar = showStar === undefined ? true : showStar
//   listStyle = listStyle || 'small'

//   const sizeStyle = listStyle === 'big' ? bigStyles : smallStyles

//   if (!onPress) {
//     switch (item.itemType) {
//       case 'album':
//         onPress = () => navigation.navigate('album', { id: item.id, title: item.name, album: item })
//         break
//       case 'artist':
//         onPress = () => navigation.navigate('artist', { id: item.id, title: item.name })
//         break
//       case 'playlist':
//         onPress = () => navigation.navigate('playlist', { id: item.id, title: item.name, playlist: item })
//         break
//     }
//   }

//   if (!subtitle) {
//     switch (item.itemType) {
//       case 'song':
//       case 'album':
//         subtitle = item.artist
//         break
//       case 'playlist':
//         subtitle = item.comment
//         break
//     }
//   }

//   const itemPressable = useCallback(
//     ({ children }) => (
//       <PressableOpacity onPress={onPress} style={styles.item} disabled={disabled}>
//         {children}
//       </PressableOpacity>
//     ),
//     [disabled, onPress],
//   )
//   const albumPressable = useCallback(
//     ({ children }) => (
//       <AlbumContextPressable
//         album={item as Album}
//         onPress={onPress}
//         triggerWrapperStyle={styles.item}
//         disabled={disabled}>
//         {children}
//       </AlbumContextPressable>
//     ),
//     [disabled, item, onPress],
//   )
//   const songPressable = useCallback(
//     ({ children }) => (
//       <SongContextPressable song={item as Song} onPress={onPress} triggerWrapperStyle={styles.item} disabled={disabled}>
//         {children}
//       </SongContextPressable>
//     ),
//     [disabled, item, onPress],
//   )
//   const artistPressable = useCallback(
//     ({ children }) => (
//       <ArtistContextPressable
//         artist={item as Artist}
//         onPress={onPress}
//         triggerWrapperStyle={styles.item}
//         disabled={disabled}>
//         {children}
//       </ArtistContextPressable>
//     ),
//     [disabled, item, onPress],
//   )

//   let PressableComponent = itemPressable
//   if (item.itemType === 'album') {
//     PressableComponent = albumPressable
//   } else if (item.itemType === 'song') {
//     PressableComponent = songPressable
//   } else if (item.itemType === 'artist') {
//     PressableComponent = artistPressable
//   }

//   let title = <></>
//   if (item.itemType === 'song' && queueId !== undefined) {
//     title = <ItemTextTitleSong contextId={contextId} queueId={queueId} title={item.title} />
//   } else if (item.itemType !== 'song') {
//     title = <ItemTextTitle title={item.name} />
//   }

//   const artStyle = { ...styles.art, ...sizeStyle.art }
//   const resizeMode = 'cover'
//   let coverArt = <></>
//   if (item.itemType === 'artist') {
//     coverArt = (
//       <CoverArt
//         type="artist"
//         artistId={item.id}
//         round={true}
//         style={artStyle}
//         resizeMode={resizeMode}
//         size="thumbnail"
//       />
//     )
//   } else if (item.itemType === 'song') {
//     coverArt = (
//       <CoverArt type="album" albumId={item.albumId} style={artStyle} resizeMode={resizeMode} size="thumbnail" />
//     )
//   } else {
//     coverArt = (
//       <CoverArt type="cover" coverArt={item.coverArt} style={artStyle} resizeMode={resizeMode} size="thumbnail" />
//     )
//   }

//   return (
//     <View style={[styles.container, sizeStyle.container, style]}>
//       <PressableComponent>
//         {showArt && coverArt}
//         <View style={styles.text}>
//           {title}
//           {subtitle !== undefined && (
//             <ItemTextLineWrapper>
//               {isFetching &&
//                 (progress !== undefined && progress > 0.01 ? (
//                   <ItemTextLineIconWrapper>
//                     <Progress.Pie
//                       size={13}
//                       borderWidth={1}
//                       style={styles.downloadedIcon}
//                       color={colors.text.secondary}
//                       progress={progress}
//                     />
//                   </ItemTextLineIconWrapper>
//                 ) : (
//                   <ItemTextLineIconWrapper>
//                     <ActivityIndicator size={14} color={colors.text.secondary} style={styles.downloadActivity} />
//                   </ItemTextLineIconWrapper>
//                 ))}
//               {songPath && (
//                 <ItemTextLineIconWrapper>
//                   <IconMat
//                     name="file-download-done"
//                     size={15}
//                     color={colors.text.secondary}
//                     style={styles.downloadedIcon}
//                   />
//                 </ItemTextLineIconWrapper>
//               )}
//               <ItemTextSubtitle subtitle={subtitle} />
//             </ItemTextLineWrapper>
//           )}
//         </View>
//       </PressableComponent>
//       <View style={styles.controls}>
//         {showStar && item.itemType !== 'playlist' && (
//           <PressableStar id={item.id} type={item.itemType} size={26} style={styles.controlItem} disabled={disabled} />
//         )}
//         <PressableOpacity onPress={() => setEnableDownload(true)} style={styles.controlItem} disabled={disabled}>
//           <IconFA name="download" color={colors.text.secondary} size={26} />
//         </PressableOpacity>
//       </View>
//     </View>
//   )
// }

const ItemTextTitleSong = React.memo<{
  contextId?: string
  queueId: number
  title?: string
}>(({ contextId, queueId, title }) => {
  const playing = useIsPlaying(contextId, queueId)

  const titleStyle: StyleProp<TextStyle> = [styles.titleText]
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

const ItemTextTitle = React.memo<{
  title?: string
}>(({ title }) => (
  <ItemTextLineWrapper>
    <Text style={styles.titleText}>{title}</Text>
  </ItemTextLineWrapper>
))

const ItemTextWrapper: React.FC = ({ children }) => <View style={styles.text}>{children}</View>

const ItemTextLineWrapper: React.FC = ({ children }) => <View style={styles.textLine}>{children}</View>

const ItemTextLineIconWrapper: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return <View style={styles.textLineIcon}>{children}</View>
}

const ItemText = React.memo<{
  title?: string
  subtitle?: string
}>(({ title, subtitle }) => (
  <ItemTextWrapper>
    <ItemTextTitle title={title} />
    {!!subtitle && (
      <ItemTextLineWrapper>
        <ItemTextSubtitle subtitle={subtitle} />
      </ItemTextLineWrapper>
    )}
  </ItemTextWrapper>
))

const ItemTextSubtitle = React.memo<{
  subtitle?: string
}>(({ subtitle }) => (
  <Text numberOfLines={1} style={styles.subtitle}>
    {subtitle}
  </Text>
))

const ItemControls = React.memo<{
  id: string
  type: StarrableItemType
}>(props => (
  <View style={styles.controls}>
    <PressableStar {...props} size={26} style={styles.controlItem} />
  </View>
))

type SizeProp = { size?: number }
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
  size?: number
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

const ItemWrapper: React.FC<{
  size: number
  style?: StyleProp<ViewStyle>
}> = ({ children, size, style }) => {
  return <View style={[styles.container, { height: size }, style]}>{children}</View>
}

type ListItemCoverArtProps =
  | (Omit<CoverArtImageProps, 'size'> & Required<SizeProp>)
  | (Omit<AlbumIdImageProps, 'size'> & Required<SizeProp>)
  | (Omit<ArtistImageProps, 'size'> & Required<SizeProp>)

const ItemCoverArt = React.memo<ListItemCoverArtProps>(props => {
  return (
    <CoverArt
      {...props}
      style={{ ...styles.art, ...{ height: props.size, width: props.size } }}
      resizeMode="cover"
      size="thumbnail"
    />
  )
})

const useDefaultProps: <T extends ListItemProps>(props: T) => T & Required<Pick<T, 'size' | 'showStar'>> = props => {
  return {
    ...props,
    size: props.size || listItemDefault.size,
    showStar: props.showStar === undefined ? true : props.showStar,
  }
}

export const AlbumListItem = React.memo<ListItemProps & AlbumProp>(props => {
  const { album, onPress, showArt, showStar, size, style } = useDefaultProps(props)

  return (
    <ItemWrapper size={size} style={style}>
      <AlbumItemPressable album={album} onPress={onPress}>
        {showArt && <ItemCoverArt type="cover" coverArt={album.coverArt} size={size} />}
        <ItemText title={album.name} subtitle={album.artist} />
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
        <ItemText title={artist.name} />
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
        <ItemText title={playlist.name} subtitle={playlist.comment} />
      </PlaylistItemPressable>
    </ItemWrapper>
  )
}, equal)

export const SongListItem = React.memo<ListItemProps & SongProps>(props => {
  const { song, contextId, queueId, onPress, showArt, showStar, size, style, subtitle } = useDefaultProps(props)
  const { data: songPath, setEnableDownload, isFetching, progress } = useQuerySongPath(song.id)

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
          <ItemTextTitleSong contextId={contextId} queueId={queueId} title={song.title} />
          <ItemTextLineWrapper>
            {isFetching &&
              (progress !== undefined && progress > 0.01 ? (
                <ItemTextLineIconWrapper>
                  <Progress.Pie
                    size={13}
                    borderWidth={1}
                    style={styles.downloadedIcon}
                    color={colors.text.secondary}
                    progress={progress}
                  />
                </ItemTextLineIconWrapper>
              ) : (
                <ItemTextLineIconWrapper>
                  <ActivityIndicator size={14} color={colors.text.secondary} style={styles.downloadActivity} />
                </ItemTextLineIconWrapper>
              ))}
            {!!songPath && (
              <ItemTextLineIconWrapper>
                <IconMat
                  name="file-download-done"
                  size={15}
                  color={colors.text.secondary}
                  style={styles.downloadedIcon}
                />
              </ItemTextLineIconWrapper>
            )}
            <ItemTextSubtitle subtitle={subtitleText} />
          </ItemTextLineWrapper>
        </ItemTextWrapper>
      </SongItemPressable>
      {showStar && <ItemControls id={song.id} type="song" />}
      {/* <View style={styles.controls}>
        {showStar && <PressableStar id={song.id} type="song" size={26} style={styles.controlItem} />}
        <PressableOpacity onPress={() => setEnableDownload(true)} style={styles.controlItem}>
          <IconFA name="download" color={colors.text.secondary} size={26} />
        </PressableOpacity>
      </View> */}
    </ItemWrapper>
  )
}, equal)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: listItemDefault.marginBottom,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  art: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    // backgroundColor: 'red',
  },
  textLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    // backgroundColor: 'green',
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.medium,
    color: colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 19,
    // backgroundColor: 'blue',
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.text.secondary,
    letterSpacing: -0.2,
    lineHeight: 19,
    // backgroundColor: 'green',
  },
  titlePlaying: {
    fontFamily: font.semiBold,
    color: colors.accent,
  },
  playingIcon: {
    // paddingRight: 4,
    paddingBottom: 1,
    // backgroundColor: 'green',
  },
  textLineIcon: {
    flexDirection: 'row',
    width: 14,
    // backgroundColor: 'green',
    // justifyContent: 'center',
    // alignContent: 'center',
    // alignItems: 'center',
  },
  downloadedIcon: {
    flex: 1,
    // marginRight: 2,
    // marginLeft: -3,
    // width: 20,
    // backgroundColor: 'green',
  },
  downloadActivity: {
    flex: 1,
    paddingRight: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlItem: {
    marginLeft: 16,
  },
})
