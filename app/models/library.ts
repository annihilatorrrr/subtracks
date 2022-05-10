export interface Artist {
  itemType: 'artist'
  id: string
  name: string
  starred?: number
  coverArt?: string
}

export interface ArtistAlbums {
  artist: Artist
  albums: Album[]
}

export interface ArtistInfo {
  id: string
  smallImageUrl?: string
  largeImageUrl?: string
}

export interface Album {
  itemType: 'album'
  id: string
  name: string
  artist?: string
  artistId?: string
  starred?: number
  coverArt?: string
  year?: number
}

export interface AlbumSongs {
  album: Album
  songs: Song[]
}

export interface Playlist {
  itemType: 'playlist'
  id: string
  name: string
  comment?: string
  coverArt?: string
}

export interface PlaylistSongs {
  playlist: Playlist
  songs: Song[]
}

export interface Song {
  itemType: 'song'
  id: string
  album?: string
  albumId?: string
  artist?: string
  artistId?: string
  title: string
  track?: number
  discNumber?: number
  duration?: number
  starred?: number
  playCount?: number
  userRating?: number
  averageRating?: number
}

export interface SearchResults {
  artists: Artist[]
  albums: Album[]
  songs: Song[]
}

export type StarrableItemType = 'album' | 'song' | 'artist'

export type ListableItem = Album | Song | Artist | Playlist

export interface AlbumCoverArt {
  albumId: string
  coverArt?: string
}
