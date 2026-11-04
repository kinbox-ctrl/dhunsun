/**
 * Catalog provider: Audius public API (free, CORS-friendly, millions of tracks).
 * Everything is normalized into Dhunsun's own Track / Artist / Collection shapes
 * so the rest of the app never depends on provider field names.
 */
import { db, now } from '../lib/db.ts';
import { env } from '../lib/env.ts';
import { HttpError } from '../lib/errors.ts';

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
}

type Raw = Record<string, any>;

const pick = (o: Raw | null | undefined, k: string): string | null => (o && typeof o[k] === 'string' ? o[k] : null);

export function normalizeArtist(u: Raw): Artist {
  return {
    id: u.id,
    name: u.name ?? u.handle,
    handle: u.handle,
    avatar: pick(u.profile_picture, '480x480') ?? pick(u.profile_picture, '150x150'),
    cover: pick(u.cover_photo, '2000x') ?? pick(u.cover_photo, '640x'),
    bio: u.bio ?? null,
    verified: Boolean(u.is_verified),
    followerCount: u.follower_count ?? 0,
    trackCount: u.track_count ?? 0,
    location: u.location ?? null,
  };
}

export function normalizeTrack(t: Raw): Track | null {
  if (!t || !t.id || t.is_delete || t.is_unlisted || t.is_stream_gated) return null;
  const u = t.user ?? {};
  return {
    id: t.id,
    title: t.title,
    artist: {
      id: u.id,
      name: u.name ?? u.handle ?? 'Unknown',
      handle: u.handle ?? '',
      avatar: pick(u.profile_picture, '150x150'),
      verified: Boolean(u.is_verified),
    },
    artwork: pick(t.artwork, '480x480') ?? pick(t.artwork, '150x150'),
    artworkLarge: pick(t.artwork, '1000x1000') ?? pick(t.artwork, '480x480'),
    duration: t.duration ?? 0,
    genre: t.genre ?? null,
    mood: t.mood ?? null,
    playCount: t.play_count ?? 0,
    favoriteCount: t.favorite_count ?? 0,
    repostCount: t.repost_count ?? 0,
    releaseDate: t.release_date ?? t.created_at ?? null,
    streamUrl: `/api/stream/${t.id}`,
    permalink: t.permalink ? `https://audius.co${t.permalink}` : null,
    bpm: t.bpm ?? null,
    tags: typeof t.tags === 'string' ? t.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
  };
}

export function normalizeCollection(p: Raw): Collection {
  return {
    id: p.id,
    name: p.playlist_name,
    description: p.description ?? null,
    artwork: pick(p.artwork, '480x480') ?? pick(p.artwork, '150x150'),
    isAlbum: Boolean(p.is_album),
    trackCount: p.track_count ?? 0,
    owner: { id: p.user?.id, name: p.user?.name ?? p.user?.handle ?? 'Unknown', handle: p.user?.handle ?? '' },
    favoriteCount: p.favorite_count ?? 0,
    repostCount: p.repost_count ?? 0,
  };
}

/* ---------- persisted cache + in-flight dedupe ---------- */

const inflight = new Map<string, Promise<any>>();
const getCache = db.prepare('SELECT body, expires_at FROM api_cache WHERE key = ?');
const putCache = db.prepare(
  'INSERT INTO api_cache(key, body, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body, expires_at = excluded.expires_at',
);

export async function audiusGet<T = any>(pathname: string, params: Record<string, string | number | undefined> = {}, ttlMs = 5 * 60_000): Promise<T> {
  const url = new URL(env.audiusBase + pathname);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  url.searchParams.set('app_name', env.audiusApp);
  const key = url.toString();

  const cached = getCache.get(key) as { body: string; expires_at: number } | undefined;
  if (cached && cached.expires_at > now()) return JSON.parse(cached.body);

  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(key, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      if (!res.ok) {
        if (cached) return JSON.parse(cached.body); // stale-while-error
        throw new HttpError(res.status === 404 ? 404 : 502, `Catalog provider returned ${res.status}`, 'upstream');
      }
      const json = (await res.json()) as { data: T };
      putCache.run(key, JSON.stringify(json.data), now() + ttlMs);
      return json.data;
    } catch (e) {
      if (cached) return JSON.parse(cached.body);
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, 'Catalog provider unavailable', 'upstream');
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

const tracksOf = (raw: Raw[] | undefined) => (raw ?? []).map(normalizeTrack).filter((t): t is Track => t !== null);

/* ---------- public catalog API ---------- */

export const catalog = {
  trending: async (genre?: string, time: 'week' | 'month' | 'allTime' = 'week', limit = 40) =>
    tracksOf(await audiusGet('/tracks/trending', { genre, time, limit }, 15 * 60_000)),

  underground: async (limit = 30) => tracksOf(await audiusGet('/tracks/trending/underground', { limit }, 15 * 60_000)),

  searchTracks: async (query: string, limit = 30, genre?: string) =>
    tracksOf(await audiusGet('/tracks/search', { query, limit, genre, only_downloadable: 'false' }, 10 * 60_000)),

  searchArtists: async (query: string, limit = 12) => ((await audiusGet<Raw[]>('/users/search', { query, limit }, 10 * 60_000)) ?? []).map(normalizeArtist),

  searchPlaylists: async (query: string, limit = 12) =>
    ((await audiusGet<Raw[]>('/playlists/search', { query, limit }, 10 * 60_000)) ?? []).map(normalizeCollection),

  track: async (id: string) => {
    const t = normalizeTrack(await audiusGet<Raw>(`/tracks/${encodeURIComponent(id)}`, {}, 60 * 60_000));
    if (!t) throw new HttpError(404, 'Track unavailable', 'not_found');
    return t;
  },

  tracksBulk: async (ids: string[]) => {
    const out = await Promise.allSettled(ids.map((id) => catalog.track(id)));
    return out.filter((r): r is PromiseFulfilledResult<Track> => r.status === 'fulfilled').map((r) => r.value);
  },

  artist: async (id: string) => normalizeArtist(await audiusGet<Raw>(`/users/${encodeURIComponent(id)}`, {}, 60 * 60_000)),

  artistTracks: async (id: string, limit = 50, sort: 'date' | 'plays' = 'plays') =>
    tracksOf(await audiusGet(`/users/${encodeURIComponent(id)}/tracks`, { limit, sort }, 30 * 60_000)),

  artistRelated: async (id: string, limit = 10) =>
    ((await audiusGet<Raw[]>(`/users/${encodeURIComponent(id)}/related`, { limit }, 60 * 60_000)) ?? []).map(normalizeArtist),

  trendingPlaylists: async (limit = 20, time: 'week' | 'month' | 'year' = 'week') =>
    ((await audiusGet<Raw[]>('/playlists/trending', { limit, time }, 30 * 60_000)) ?? []).map(normalizeCollection),

  collection: async (id: string) => {
    const data = await audiusGet<Raw[]>(`/playlists/${encodeURIComponent(id)}`, {}, 30 * 60_000);
    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) throw new HttpError(404, 'Playlist not found', 'not_found');
    const tracks = tracksOf(await audiusGet(`/playlists/${encodeURIComponent(id)}/tracks`, {}, 30 * 60_000));
    return { ...normalizeCollection(raw), tracks };
  },

  streamLocation: async (id: string): Promise<string> => {
    const url = `${env.audiusBase}/tracks/${encodeURIComponent(id)}/stream?app_name=${env.audiusApp}`;
    const res = await fetch(url, { redirect: 'manual' });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) return loc;
    if (res.ok) return url;
    throw new HttpError(404, 'Stream unavailable', 'not_found');
  },
};

export const GENRES = [
  'Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Rock', 'Alternative', 'Lo-Fi', 'Ambient', 'House', 'Techno',
  'Trap', 'Dubstep', 'Drum & Bass', 'Jazz', 'Classical', 'Folk', 'Latin', 'Reggae', 'Metal', 'Punk', 'Soundtrack',
  'World', 'Experimental', 'Disco', 'Funk', 'Country', 'Blues', 'Kids', 'Comedy', 'Spoken Word', 'Devotional',
] as const;

export const MOODS = [
  'Peaceful', 'Romantic', 'Sentimental', 'Tender', 'Easygoing', 'Yearning', 'Sophisticated', 'Sensual', 'Cool',
  'Gritty', 'Melancholy', 'Serious', 'Brooding', 'Fiery', 'Defiant', 'Aggressive', 'Rowdy', 'Excited', 'Energizing',
  'Empowering', 'Stirring', 'Upbeat', 'Other',
] as const;
