import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth, schemas, v, validate, wrap } from '../middleware/index.ts';
import * as lib from '../services/library.ts';
import { tasteSummary } from '../services/recommendations.ts';

export const libraryRouter = Router();

const ids = z.object({ trackIds: z.array(z.string().min(1).max(64)).min(1).max(200) });
const playlistInput = z.object({ name: z.string().min(1).max(80), description: z.string().max(300).optional(), isPublic: z.boolean().optional() });

/* ---- public playlist view (shareable links) ---- */
libraryRouter.get('/playlists/:id', optionalAuth, validate(schemas.id, 'params'), wrap(async (req, res) => {
  res.json({ playlist: await lib.getPlaylist(req.params.id as string, req.user?.id ?? null) });
}));

libraryRouter.use(requireAuth);

/* ---- likes ---- */
libraryRouter.get('/likes', wrap(async (req, res) => {
  const tracks = await lib.hydrate(lib.likedIds(req.user!.id));
  res.json({ tracks, totalDuration: tracks.reduce((s, t) => s + t.duration, 0) });
}));
libraryRouter.get('/likes/ids', (req, res) => res.json({ ids: lib.likedIds(req.user!.id) }));
libraryRouter.put('/likes/:id', validate(schemas.id, 'params'), wrap(async (req, res) => { await lib.like(req.user!.id, req.params.id as string); res.status(204).end(); }));
libraryRouter.delete('/likes/:id', validate(schemas.id, 'params'), (req, res) => { lib.unlike(req.user!.id, req.params.id as string); res.status(204).end(); });

/* ---- follows ---- */
libraryRouter.get('/follows', (req, res) => res.json({ artists: lib.followedArtists(req.user!.id) }));
libraryRouter.put('/follows/:id', validate(schemas.id, 'params'), wrap(async (req, res) => res.json({ artist: await lib.follow(req.user!.id, req.params.id as string) })));
libraryRouter.delete('/follows/:id', validate(schemas.id, 'params'), (req, res) => { lib.unfollow(req.user!.id, req.params.id as string); res.status(204).end(); });

/* ---- playlists ---- */
libraryRouter.get('/playlists', (req, res) => res.json({ playlists: lib.listPlaylists(req.user!.id) }));
libraryRouter.post('/playlists', validate(playlistInput), (req, res) => res.status(201).json({ playlist: lib.createPlaylist(req.user!.id, v(req)) }));
libraryRouter.patch('/playlists/:id', validate(schemas.id, 'params'), validate(playlistInput.partial()), (req, res) => res.json({ playlist: lib.updatePlaylist(req.user!.id, req.params.id as string, v(req)) }));
libraryRouter.delete('/playlists/:id', validate(schemas.id, 'params'), (req, res) => { lib.deletePlaylist(req.user!.id, req.params.id as string); res.status(204).end(); });
libraryRouter.post('/playlists/:id/tracks', validate(schemas.id, 'params'), validate(ids), wrap(async (req, res) => {
  await lib.addToPlaylist(req.user!.id, req.params.id as string, v<{ trackIds: string[] }>(req).trackIds);
  res.status(204).end();
}));
libraryRouter.delete('/playlists/:id/tracks/:trackId', validate(schemas.id, 'params'), (req, res) => {
  lib.removeFromPlaylist(req.user!.id, req.params.id as string, req.params.trackId as string);
  res.status(204).end();
});
libraryRouter.put('/playlists/:id/order', validate(schemas.id, 'params'), validate(ids), (req, res) => {
  lib.reorderPlaylist(req.user!.id, req.params.id as string, v<{ trackIds: string[] }>(req).trackIds);
  res.status(204).end();
});

/* ---- history & insights ---- */
libraryRouter.post('/history', validate(z.object({ trackId: z.string().min(1).max(64), secondsPlayed: z.number().min(0).max(36_000).default(0), completed: z.boolean().default(false) })), wrap(async (req, res) => {
  const { trackId, secondsPlayed, completed } = v<{ trackId: string; secondsPlayed: number; completed: boolean }>(req);
  await lib.recordPlay(req.user!.id, trackId, secondsPlayed, completed);
  res.status(204).end();
}));
libraryRouter.get('/history', wrap(async (req, res) => res.json({ tracks: await lib.recentlyPlayed(req.user!.id, 50) })));
libraryRouter.delete('/history', (req, res) => { lib.clearHistory(req.user!.id); res.status(204).end(); });
libraryRouter.get('/insights', wrap(async (req, res) => {
  const id = req.user!.id;
  const [top, taste] = await Promise.all([lib.topTracks(id, 30, 10), tasteSummary(id)]);
  res.json({ stats: lib.stats(id), topTracks: top, topArtists: lib.topArtists(id, 30, 8), topGenres: lib.topGenres(id), taste });
}));

/* ---- cross-device player state ---- */
libraryRouter.get('/player', (req, res) => res.json({ state: lib.getPlayerState(req.user!.id) }));
libraryRouter.put('/player', validate(z.object({ queue: z.array(z.string()).max(500), index: z.number().int().min(0), position: z.number().min(0), shuffle: z.boolean(), repeat: z.enum(['off', 'all', 'one']), volume: z.number().min(0).max(1) })), (req, res) => {
  lib.savePlayerState(req.user!.id, v(req));
  res.status(204).end();
});
