import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, schemas, v, validate, wrap } from '../middleware/index.ts';
import { catalog, GENRES, MOODS } from '../services/audius.ts';
import * as lib from '../services/library.ts';
import { homeShelves, radio } from '../services/recommendations.ts';

export const catalogRouter = Router();
catalogRouter.use(optionalAuth);

const time = z.enum(['week', 'month', 'allTime']).default('week');

catalogRouter.get('/home', wrap(async (req, res) => {
  res.json({ shelves: await homeShelves(req.user?.id ?? null) });
}));

catalogRouter.get('/genres', (_req, res) => res.json({ genres: GENRES, moods: MOODS }));

catalogRouter.get('/trending', validate(z.object({ genre: z.string().max(40).optional(), time, limit: z.coerce.number().int().min(1).max(100).default(40) }), 'query'), wrap(async (req, res) => {
  const { genre, time: t, limit } = v<{ genre?: string; time: 'week' | 'month' | 'allTime'; limit: number }>(req, 'query');
  const tracks = await catalog.trending(genre, t, limit);
  lib.rememberTracks(tracks);
  res.json({ tracks });
}));

catalogRouter.get('/search', validate(z.object({ q: z.string().min(1).max(120), type: z.enum(['all', 'tracks', 'artists', 'playlists']).default('all'), genre: z.string().max(40).optional() }), 'query'), wrap(async (req, res) => {
  const { q, type, genre } = v<{ q: string; type: string; genre?: string }>(req, 'query');
  const [tracks, artists, playlists] = await Promise.all([
    type === 'all' || type === 'tracks' ? catalog.searchTracks(q, type === 'tracks' ? 50 : 24, genre) : [],
    type === 'all' || type === 'artists' ? catalog.searchArtists(q, type === 'artists' ? 30 : 10).catch(() => []) : [],
    type === 'all' || type === 'playlists' ? catalog.searchPlaylists(q, type === 'playlists' ? 30 : 10).catch(() => []) : [],
  ]);
  lib.rememberTracks(tracks);
  // "Top result": a strong artist name match beats a track.
  const lq = q.toLowerCase();
  const artistHit = artists.find((a) => a.name.toLowerCase() === lq || a.handle.toLowerCase() === lq);
  const top = artistHit ? { type: 'artist', item: artistHit } : tracks[0] ? { type: 'track', item: tracks[0] } : artists[0] ? { type: 'artist', item: artists[0] } : null;
  res.json({ top, tracks, artists, playlists });
}));

catalogRouter.get('/tracks/:id', validate(schemas.id, 'params'), wrap(async (req, res) => {
  const track = await catalog.track(req.params.id as string);
  lib.rememberTracks([track]);
  const user = req.user;
  res.json({ track, liked: user ? lib.isLiked(user.id, track.id) : false, inPlaylists: user ? lib.playlistsContaining(user.id, track.id) : [] });
}));

catalogRouter.get('/tracks/:id/radio', validate(schemas.id, 'params'), wrap(async (req, res) => {
  res.json({ tracks: await radio(req.params.id as string, req.user?.id ?? null) });
}));

catalogRouter.get('/artists/:id', validate(schemas.id, 'params'), wrap(async (req, res) => {
  const id = req.params.id as string;
  const artist = await catalog.artist(id);
  let [popular, latest, related] = await Promise.all([
    catalog.artistTracks(id, 20, 'plays').catch(() => []),
    catalog.artistTracks(id, 20, 'date').catch(() => []),
    catalog.artistRelated(id, 12).catch(() => []),
  ]);
  // Some discovery nodes return nothing for /users/:id/tracks; fall back to a search scoped to this artist.
  if (!popular.length) {
    const found = (await catalog.searchTracks(artist.name, 50).catch(() => [])).filter((t) => t.artist.id === id);
    popular = [...found].sort((a, b) => b.playCount - a.playCount);
    latest = [...found].sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  }
  lib.rememberTracks([...popular, ...latest]);
  const following = req.user ? lib.followedArtists(req.user.id).some((a) => a.id === id) : false;
  res.json({ artist, popular, latest, related, following });
}));

catalogRouter.get('/collections/trending', wrap(async (_req, res) => res.json({ collections: await catalog.trendingPlaylists(30) })));

catalogRouter.get('/collections/:id', validate(schemas.id, 'params'), wrap(async (req, res) => {
  const c = await catalog.collection(req.params.id as string);
  lib.rememberTracks(c.tracks);
  res.json({ collection: c });
}));
