/**
 * Recommendation engine. Content-based + taste-profile:
 *  - builds a per-user taste profile from history, likes and follows (genre/mood/artist weights)
 *  - scores candidate tracks pulled from trending pools in the user's top genres plus related artists
 *  - produces Spotify-style shelves: Made for you, Discover Weekly-ish mix, genre mixes, artist radios.
 */
import { catalog, type Track } from './audius.ts';
import * as lib from './library.ts';
import { rememberTracks } from './library.ts';

interface Profile {
  genres: Map<string, number>;
  moods: Map<string, number>;
  artists: Map<string, number>;
  seen: Set<string>;
}

function bump(m: Map<string, number>, k: string | null | undefined, w: number) {
  if (!k) return;
  m.set(k, (m.get(k) ?? 0) + w);
}

async function buildProfile(userId: string): Promise<Profile> {
  const p: Profile = { genres: new Map(), moods: new Map(), artists: new Map(), seen: new Set() };
  const [recent, top, liked] = await Promise.all([lib.recentlyPlayed(userId, 40), lib.topTracks(userId, 90, 40), lib.hydrate(lib.likedIds(userId).slice(0, 60))]);
  for (const t of recent) { bump(p.genres, t.genre, 1); bump(p.moods, t.mood, 0.6); bump(p.artists, t.artist.id, 1); p.seen.add(t.id); }
  for (const t of top) { const w = 1 + Math.log1p(t.userPlays ?? 1); bump(p.genres, t.genre, w); bump(p.moods, t.mood, w * 0.5); bump(p.artists, t.artist.id, w); p.seen.add(t.id); }
  for (const t of liked) { bump(p.genres, t.genre, 2.5); bump(p.moods, t.mood, 1.2); bump(p.artists, t.artist.id, 2); p.seen.add(t.id); }
  for (const a of lib.followedArtists(userId)) bump(p.artists, a.id, 3);
  return p;
}

const topKeys = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

function score(t: Track, p: Profile): number {
  const g = p.genres.get(t.genre ?? '') ?? 0;
  const m = p.moods.get(t.mood ?? '') ?? 0;
  const a = p.artists.get(t.artist.id) ?? 0;
  const popularity = Math.log1p(t.playCount) * 0.15 + Math.log1p(t.favoriteCount) * 0.25;
  const jitter = Math.random() * 0.6; // keep shelves fresh between loads
  return g * 1.2 + m * 0.8 + a * 1.6 + popularity + jitter;
}

function dedupe(tracks: Track[], seen = new Set<string>(), perArtistCap = 3): Track[] {
  const artistCount = new Map<string, number>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    const c = artistCount.get(t.artist.id) ?? 0;
    if (c >= perArtistCap) continue;
    artistCount.set(t.artist.id, c + 1);
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export interface Shelf {
  id: string;
  title: string;
  subtitle?: string;
  kind: 'tracks' | 'artists' | 'collections';
  items: unknown[];
}

export async function homeShelves(userId: string | null): Promise<Shelf[]> {
  const shelves: Shelf[] = [];
  const profile = userId ? await buildProfile(userId) : null;
  const topGenres = profile ? topKeys(profile.genres, 3) : [];

  const [trending, underground, playlists, ...genrePools] = await Promise.all([
    catalog.trending(undefined, 'week', 40),
    catalog.underground(30),
    catalog.trendingPlaylists(16),
    ...topGenres.map((g) => catalog.trending(g, 'month', 40).catch(() => [] as Track[])),
  ]);

  if (profile && profile.seen.size > 0) {
    const pool = [...genrePools.flat(), ...trending, ...underground];
    const ranked = pool.sort((a, b) => score(b, profile) - score(a, profile));
    const madeForYou = dedupe(ranked, new Set(profile.seen), 2).slice(0, 24);
    if (madeForYou.length) shelves.push({ id: 'made-for-you', title: 'Made for you', subtitle: 'Picked from your listening', kind: 'tracks', items: madeForYou });

    const recent = await lib.recentlyPlayed(userId!, 12);
    if (recent.length) shelves.push({ id: 'recent', title: 'Jump back in', kind: 'tracks', items: recent });

    const favArtists = lib.topArtists(userId!, 90, 6);
    for (const [i, g] of topGenres.entries()) {
      const mix = dedupe(genrePools[i] ?? [], new Set(), 2).slice(0, 20);
      if (mix.length) shelves.push({ id: `mix-${g}`, title: `${g} Mix`, subtitle: 'Because you listen to ' + g, kind: 'tracks', items: mix });
    }
    if (favArtists.length) {
      const related = await Promise.all(favArtists.slice(0, 3).map((a) => catalog.artistRelated(a.id, 6).catch(() => [])));
      const artists = dedupeBy(related.flat(), (a) => a.id).slice(0, 14);
      if (artists.length) shelves.push({ id: 'artists-for-you', title: 'Artists you might like', subtitle: 'Similar to ' + favArtists.slice(0, 2).map((a) => a.name).join(' & '), kind: 'artists', items: artists });
    }
  }

  shelves.push({ id: 'trending', title: 'Trending now', subtitle: 'What everyone is playing this week', kind: 'tracks', items: trending.slice(0, 24) });
  shelves.push({ id: 'playlists', title: 'Popular playlists', kind: 'collections', items: playlists });
  shelves.push({ id: 'underground', title: 'Rising underground', subtitle: 'Fresh finds before they blow up', kind: 'tracks', items: underground.slice(0, 20) });

  const moods: [string, string][] = [['Peaceful', 'Chill & focus'], ['Energizing', 'Workout energy'], ['Romantic', 'Late-night feels']];
  const moodShelves = await Promise.all(moods.map(([m]) => catalog.searchTracks(m, 20).catch(() => [] as Track[])));
  moods.forEach(([m, title], i) => {
    const items = dedupe(moodShelves[i].filter((t) => t.mood === m || true), new Set(), 2).slice(0, 16);
    if (items.length) shelves.push({ id: `mood-${m}`, title, subtitle: `${m} tracks`, kind: 'tracks', items });
  });

  rememberTracks(shelves.filter((s) => s.kind === 'tracks').flatMap((s) => s.items as Track[]));
  return shelves;
}

function dedupeBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

/** "Radio": an endless-ish queue seeded from a track. */
export async function radio(trackId: string, userId: string | null, limit = 30): Promise<Track[]> {
  const seed = await catalog.track(trackId);
  const [byArtist, related, byGenre, byTag] = await Promise.all([
    catalog.artistTracks(seed.artist.id, 10).catch(() => []),
    catalog.artistRelated(seed.artist.id, 5).catch(() => []),
    seed.genre ? catalog.trending(seed.genre, 'month', 40).catch(() => []) : Promise.resolve([] as Track[]),
    seed.tags[0] ? catalog.searchTracks(seed.tags[0], 20).catch(() => []) : Promise.resolve([] as Track[]),
  ]);
  const relatedTracks = (await Promise.all(related.slice(0, 3).map((a) => catalog.artistTracks(a.id, 6).catch(() => [])))).flat();
  const profile = userId ? await buildProfile(userId) : null;
  const pool = [...byArtist, ...relatedTracks, ...byGenre, ...byTag];
  const ranked = pool
    .map((t) => ({ t, s: (profile ? score(t, profile) : Math.log1p(t.playCount)) + (t.artist.id === seed.artist.id ? 1.5 : 0) + (t.genre === seed.genre ? 1 : 0) + (t.mood === seed.mood ? 0.8 : 0) + Math.random() }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
  const out = [seed, ...dedupe(ranked, new Set([seed.id]), 4)].slice(0, limit);
  rememberTracks(out);
  return out;
}

export async function tasteSummary(userId: string) {
  const p = await buildProfile(userId);
  return { genres: topKeys(p.genres, 5), moods: topKeys(p.moods, 5), tracksSeen: p.seen.size };
}
