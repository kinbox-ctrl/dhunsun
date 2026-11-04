export interface Track {
  id: string;
  title: string;
  artist: { id: string; name: string; handle: string; avatar: string | null; verified: boolean };
  artwork: string | null;
  artworkLarge: string | null;
  duration: number;
  genre: string | null;
  mood: string | null;
  playCount: number;
  favoriteCount: number;
  repostCount: number;
  releaseDate: string | null;
  streamUrl: string;
  permalink: string | null;
  bpm: number | null;
  tags: string[];
  addedAt?: number;
  lastPlayed?: number;
  userPlays?: number;
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  cover: string | null;
  bio: string | null;
  verified: boolean;
  followerCount: number;
  trackCount: number;
  location: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  artwork: string | null;
  isAlbum: boolean;
  trackCount: number;
  owner: { id: string; name: string; handle: string };
  favoriteCount: number;
  repostCount: number;
  tracks?: Track[];
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  description: string;
  isPublic: boolean;
  trackCount: number;
  artwork: string | null;
  mosaic: string[];
  createdAt: number;
  updatedAt: number;
  tracks?: Track[];
  totalDuration?: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  createdAt: number;
}

export interface Shelf {
  id: string;
  title: string;
  subtitle?: string;
  kind: 'tracks' | 'artists' | 'collections';
  items: Track[] | Artist[] | Collection[];
}

export interface SearchResult {
  top: { type: 'track'; item: Track } | { type: 'artist'; item: Artist } | null;
  tracks: Track[];
  artists: Artist[];
  playlists: Collection[];
}

export interface Insights {
  stats: { plays: number; secs: number; unique_tracks: number };
  topTracks: Track[];
  topArtists: { id: string; name: string; plays: number }[];
  topGenres: { genre: string; n: number }[];
  taste: { genres: string[]; moods: string[]; tracksSeen: number };
}

export type RepeatMode = 'off' | 'all' | 'one';
