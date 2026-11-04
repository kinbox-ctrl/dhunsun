import { randomUUID } from 'node:crypto';
import { db, now, transaction } from '../lib/db.ts';
import { badRequest, forbidden, notFound } from '../lib/errors.ts';
import { catalog, type Track } from './audius.ts';

/* ---------- track snapshot cache (so library views don't need N upstream calls) ---------- */

const upsertTrack = db.prepare(`
  INSERT INTO tracks(id,title,artist_id,artist_name,artwork,duration,genre,mood,play_count,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist_name=excluded.artist_name, artwork=excluded.artwork,
    duration=excluded.duration, genre=excluded.genre, mood=excluded.mood, play_count=excluded.play_count, updated_at=excluded.updated_at
`);
const trackExists = db.prepare('SELECT 1 FROM tracks WHERE id = ?');

export function rememberTracks(tracks: Track[]) {
  for (const t of tracks) {
    upsertTrack.run(t.id, t.title, t.artist.id, t.artist.name, t.artwork, t.duration, t.genre, t.mood, t.playCount, now());
  }
}

/** Ensure a track exists locally, fetching from the catalog if needed. */
export async function ensureTrack(id: string): Promise<Track> {
  const t = await catalog.track(id);
  rememberTracks([t]);
  return t;
}

async function ensureTracks(ids: string[]) {
  const missing = ids.filter((id) => !trackExists.get(id));
  if (missing.length) rememberTracks(await catalog.tracksBulk(missing));
}

/** Hydrate ids into full Track objects, preferring the live catalog (fresh artwork/plays) but falling back to snapshots. */
export async function hydrate(ids: string[]): Promise<Track[]> {
  if (!ids.length) return [];
  const live = await catalog.tracksBulk(ids);
  const byId = new Map(live.map((t) => [t.id, t]));
  const out: Track[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) out.push(t);
  }
  return out;
}

/* ---------- likes ---------- */

const q = {
  like: db.prepare('INSERT OR IGNORE INTO likes(user_id,track_id,created_at) VALUES (?,?,?)'),
  unlike: db.prepare('DELETE FROM likes WHERE user_id = ? AND track_id = ?'),
  likedIds: db.prepare('SELECT track_id FROM likes WHERE user_id = ? ORDER BY created_at DESC'),
  isLiked: db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND track_id = ?'),

  follow: db.prepare('INSERT OR IGNORE INTO follows(user_id,artist_id,artist_name,artist_avatar,created_at) VALUES (?,?,?,?,?)'),
  unfollow: db.prepare('DELETE FROM follows WHERE user_id = ? AND artist_id = ?'),
  follows: db.prepare('SELECT artist_id id, artist_name name, artist_avatar avatar, created_at FROM follows WHERE user_id = ? ORDER BY created_at DESC'),

  playlists: db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) track_count,
      (SELECT t.artwork FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id ORDER BY pt.position LIMIT 1) first_artwork
    FROM playlists p WHERE p.owner_id = ? ORDER BY p.updated_at DESC`),
  playlist: db.prepare(`
    SELECT p.*, u.username owner_name, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) track_count,
      (SELECT t.artwork FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id ORDER BY pt.position LIMIT 1) first_artwork
    FROM playlists p JOIN users u ON u.id = p.owner_id WHERE p.id = ?`),
  playlistTrackIds: db.prepare('SELECT track_id, added_at FROM playlist_tracks WHERE playlist_id = ? ORDER BY position'),
  playlistArtworks: db.prepare('SELECT t.artwork FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = ? AND t.artwork IS NOT NULL ORDER BY pt.position LIMIT 4'),
  createPlaylist: db.prepare('INSERT INTO playlists(id,owner_id,name,description,is_public,created_at,updated_at) VALUES (?,?,?,?,?,?,?)'),
  updatePlaylist: db.prepare('UPDATE playlists SET name = ?, description = ?, is_public = ?, updated_at = ? WHERE id = ?'),
  touchPlaylist: db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?'),
  deletePlaylist: db.prepare('DELETE FROM playlists WHERE id = ?'),
  maxPos: db.prepare('SELECT COALESCE(MAX(position), -1) m FROM playlist_tracks WHERE playlist_id = ?'),
  addTrack: db.prepare('INSERT OR IGNORE INTO playlist_tracks(playlist_id,track_id,position,added_at) VALUES (?,?,?,?)'),
  removeTrack: db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'),
  setPos: db.prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'),
  containing: db.prepare('SELECT playlist_id FROM playlist_tracks pt JOIN playlists p ON p.id = pt.playlist_id WHERE p.owner_id = ? AND pt.track_id = ?'),

  addHistory: db.prepare('INSERT INTO history(user_id,track_id,played_at,seconds_played,completed) VALUES (?,?,?,?,?)'),
  recent: db.prepare('SELECT track_id, MAX(played_at) last FROM history WHERE user_id = ? GROUP BY track_id ORDER BY last DESC LIMIT ?'),
  topTracks: db.prepare('SELECT track_id, COUNT(*) plays, SUM(seconds_played) secs FROM history WHERE user_id = ? AND played_at > ? GROUP BY track_id ORDER BY plays DESC, secs DESC LIMIT ?'),
  topGenres: db.prepare(`SELECT t.genre, COUNT(*) n FROM history h JOIN tracks t ON t.id = h.track_id WHERE h.user_id = ? AND t.genre IS NOT NULL GROUP BY t.genre ORDER BY n DESC LIMIT ?`),
  topArtists: db.prepare(`SELECT t.artist_id id, t.artist_name name, COUNT(*) plays FROM history h JOIN tracks t ON t.id = h.track_id WHERE h.user_id = ? AND h.played_at > ? GROUP BY t.artist_id ORDER BY plays DESC LIMIT ?`),
  stats: db.prepare('SELECT COUNT(*) plays, COALESCE(SUM(seconds_played),0) secs, COUNT(DISTINCT track_id) unique_tracks FROM history WHERE user_id = ?'),
  clearHistory: db.prepare('DELETE FROM history WHERE user_id = ?'),

  getPlayer: db.prepare('SELECT state_json FROM player_state WHERE user_id = ?'),
  putPlayer: db.prepare('INSERT INTO player_state(user_id,state_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at'),
};

export async function like(userId: string, trackId: string) {
  await ensureTrack(trackId);
  q.like.run(userId, trackId, now());
}
export const unlike = (userId: string, trackId: string) => q.unlike.run(userId, trackId);
export const likedIds = (userId: string) => (q.likedIds.all(userId) as { track_id: string }[]).map((r) => r.track_id);
export const isLiked = (userId: string, trackId: string) => Boolean(q.isLiked.get(userId, trackId));

/* ---------- follows ---------- */

export async function follow(userId: string, artistId: string) {
  const a = await catalog.artist(artistId);
  q.follow.run(userId, a.id, a.name, a.avatar, now());
  return a;
}
export const unfollow = (userId: string, artistId: string) => q.unfollow.run(userId, artistId);
export const followedArtists = (userId: string) => q.follows.all(userId) as { id: string; name: string; avatar: string | null; created_at: number }[];

/* ---------- playlists ---------- */

interface PlaylistRow {
  id: string;
  owner_id: string;
  owner_name?: string;
  name: string;
  description: string;
  is_public: number;
  created_at: number;
  updated_at: number;
  track_count: number;
  first_artwork: string | null;
}

export interface PlaylistSummary {
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
}

function toSummary(r: PlaylistRow): PlaylistSummary {
  const mosaic = (q.playlistArtworks.all(r.id) as { artwork: string }[]).map((x) => x.artwork);
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    name: r.name,
    description: r.description,
    isPublic: Boolean(r.is_public),
    trackCount: r.track_count,
    artwork: r.first_artwork,
    mosaic,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listPlaylists = (userId: string) => (q.playlists.all(userId) as unknown as PlaylistRow[]).map(toSummary);

function loadPlaylist(id: string, userId: string | null): PlaylistRow {
  const r = q.playlist.get(id) as PlaylistRow | undefined;
  if (!r) throw notFound('Playlist not found');
  if (!r.is_public && r.owner_id !== userId) throw forbidden('This playlist is private');
  return r;
}

function ownPlaylist(id: string, userId: string): PlaylistRow {
  const r = q.playlist.get(id) as PlaylistRow | undefined;
  if (!r) throw notFound('Playlist not found');
  if (r.owner_id !== userId) throw forbidden('You do not own this playlist');
  return r;
}

export async function getPlaylist(id: string, userId: string | null) {
  const r = loadPlaylist(id, userId);
  const rows = q.playlistTrackIds.all(id) as { track_id: string; added_at: number }[];
  const tracks = await hydrate(rows.map((x) => x.track_id));
  const addedAt = new Map(rows.map((x) => [x.track_id, x.added_at]));
  return {
    ...toSummary(r),
    tracks: tracks.map((t) => ({ ...t, addedAt: addedAt.get(t.id) })),
    totalDuration: tracks.reduce((s, t) => s + t.duration, 0),
  };
}

export function createPlaylist(userId: string, input: { name: string; description?: string; isPublic?: boolean }) {
  const id = randomUUID();
  q.createPlaylist.run(id, userId, input.name.trim(), input.description?.trim() ?? '', input.isPublic ? 1 : 0, now(), now());
  return toSummary(q.playlist.get(id) as unknown as PlaylistRow);
}

export function updatePlaylist(userId: string, id: string, patch: { name?: string; description?: string; isPublic?: boolean }) {
  const r = ownPlaylist(id, userId);
  q.updatePlaylist.run(patch.name?.trim() || r.name, patch.description?.trim() ?? r.description, patch.isPublic === undefined ? r.is_public : patch.isPublic ? 1 : 0, now(), id);
  return toSummary(q.playlist.get(id) as unknown as PlaylistRow);
}

export function deletePlaylist(userId: string, id: string) {
  ownPlaylist(id, userId);
  q.deletePlaylist.run(id);
}

export async function addToPlaylist(userId: string, id: string, trackIds: string[]) {
  ownPlaylist(id, userId);
  await ensureTracks(trackIds);
  transaction(() => {
    let pos = (q.maxPos.get(id) as { m: number }).m;
    for (const t of trackIds) {
      if (!trackExists.get(t)) continue;
      q.addTrack.run(id, t, ++pos, now());
    }
    q.touchPlaylist.run(now(), id);
  });
}

export function removeFromPlaylist(userId: string, id: string, trackId: string) {
  ownPlaylist(id, userId);
  q.removeTrack.run(id, trackId);
  q.touchPlaylist.run(now(), id);
}

export function reorderPlaylist(userId: string, id: string, orderedIds: string[]) {
  ownPlaylist(id, userId);
  const existing = new Set((q.playlistTrackIds.all(id) as { track_id: string }[]).map((r) => r.track_id));
  if (orderedIds.length !== existing.size || !orderedIds.every((x) => existing.has(x))) throw badRequest('Order must contain exactly the playlist tracks');
  transaction(() => {
    orderedIds.forEach((t, i) => q.setPos.run(i, id, t));
    q.touchPlaylist.run(now(), id);
  });
}

export const playlistsContaining = (userId: string, trackId: string) => (q.containing.all(userId, trackId) as { playlist_id: string }[]).map((r) => r.playlist_id);

/* ---------- history / stats ---------- */

export async function recordPlay(userId: string, trackId: string, secondsPlayed: number, completed: boolean) {
  await ensureTrack(trackId);
  q.addHistory.run(userId, trackId, now(), Math.max(0, Math.round(secondsPlayed)), completed ? 1 : 0);
}

export async function recentlyPlayed(userId: string, limit = 20) {
  const rows = q.recent.all(userId, limit) as { track_id: string; last: number }[];
  const tracks = await hydrate(rows.map((r) => r.track_id));
  const lastMap = new Map(rows.map((r) => [r.track_id, r.last]));
  return tracks.map((t) => ({ ...t, lastPlayed: lastMap.get(t.id) }));
}

export async function topTracks(userId: string, days = 30, limit = 20) {
  const rows = q.topTracks.all(userId, now() - days * 86_400_000, limit) as { track_id: string; plays: number }[];
  const tracks = await hydrate(rows.map((r) => r.track_id));
  const plays = new Map(rows.map((r) => [r.track_id, r.plays]));
  return tracks.map((t) => ({ ...t, userPlays: plays.get(t.id) }));
}

export const topGenres = (userId: string, limit = 6) => q.topGenres.all(userId, limit) as { genre: string; n: number }[];
export const topArtists = (userId: string, days = 30, limit = 10) => q.topArtists.all(userId, now() - days * 86_400_000, limit) as { id: string; name: string; plays: number }[];
export const stats = (userId: string) => q.stats.get(userId) as { plays: number; secs: number; unique_tracks: number };
export const clearHistory = (userId: string) => q.clearHistory.run(userId);

/* ---------- player state sync ---------- */

export function getPlayerState(userId: string): unknown | null {
  const r = q.getPlayer.get(userId) as { state_json: string } | undefined;
  return r ? JSON.parse(r.state_json) : null;
}
export const savePlayerState = (userId: string, state: unknown) => q.putPlayer.run(userId, JSON.stringify(state), now());
