import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArtistCard, CardGrid, CollectionCard, TrackCard } from '../components/Cards';
import { TrackList } from '../components/TrackList';
import { Cover, Empty, PlayButton, SectionTitle, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { hueFrom } from '../lib/format';
import type { SearchResult } from '../lib/types';
import { usePlayer } from '../store/player';
import { Search as SearchIcon } from 'lucide-react';

const TYPES = [['all', 'All'], ['tracks', 'Songs'], ['artists', 'Artists'], ['playlists', 'Playlists']] as const;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const type = (params.get('type') ?? 'all') as (typeof TYPES)[number][0];
  const genre = params.get('genre') ?? undefined;
  const { data, isLoading } = useQuery({ queryKey: ['search', q, type, genre], queryFn: () => get<SearchResult>('/api/catalog/search', { q, type, genre }), enabled: q.length > 0, staleTime: 60_000 });
  const { data: genres } = useQuery({ queryKey: ['genres'], queryFn: () => get<{ genres: string[]; moods: string[] }>('/api/catalog/genres'), staleTime: Infinity });
  const { current, playing, playTrack, playTracks } = usePlayer();

  if (!q) {
    return (
      <div className="fade-up">
        <h1 className="mb-5 text-2xl font-extrabold">Browse all</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {genres?.genres.map((g) => (
            <Link key={g} to={`/genre/${encodeURIComponent(g)}`} className="relative aspect-[1.6] overflow-hidden rounded-lg p-4 text-2xl font-extrabold transition hover:scale-[1.02]" style={{ background: `hsl(${hueFrom(g)} 60% 40%)` }}>
              {g}
              <span className="absolute -bottom-2 -right-3 h-20 w-20 rotate-[25deg] rounded-md bg-black/30 shadow-xl" />
            </Link>
          ))}
          {!genres && Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="aspect-[1.6]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-8">
      <div className="flex flex-wrap gap-2">
        {TYPES.map(([k, l]) => (
          <button key={k} onClick={() => setParams((p) => { p.set('type', k); return p; })} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold transition', type === k ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20')}>{l}</button>
        ))}
      </div>

      {isLoading && <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]"><Skeleton className="h-56" /><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div></div>}

      {data && type === 'all' && (
        <>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {data.top && (
              <section>
                <SectionTitle>Top result</SectionTitle>
                {data.top.type === 'artist' ? (
                  <Link to={`/artist/${data.top.item.id}`} className="group block rounded-lg bg-elevated p-5 transition hover:bg-highlight">
                    <Cover src={data.top.item.avatar} alt={data.top.item.name} rounded="rounded-full" className="mb-5 h-24 w-24 shadow-xl" seed={data.top.item.id} />
                    <p className="line-clamp-1 text-3xl font-extrabold">{data.top.item.name}</p>
                    <p className="mt-1 text-sm text-subtle">Artist</p>
                  </Link>
                ) : (
                  <Link to={`/track/${data.top.item.id}`} className="group relative block rounded-lg bg-elevated p-5 transition hover:bg-highlight">
                    <Cover src={data.top.item.artwork} alt={data.top.item.title} className="mb-5 h-24 w-24 shadow-xl" seed={data.top.item.id} />
                    <p className="line-clamp-1 text-3xl font-extrabold">{data.top.item.title}</p>
                    <p className="mt-1 text-sm text-subtle">Song · <span className="text-white">{data.top.item.artist.name}</span></p>
                    <PlayButton playing={current?.id === data.top.item.id && playing} onClick={() => playTrack(data.top!.item as never, data.tracks, `Search: ${q}`)} className="absolute bottom-5 right-5 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                )}
              </section>
            )}
            <section>
              <SectionTitle>Songs</SectionTitle>
              <TrackList tracks={data.tracks.slice(0, 5)} label={`Search: ${q}`} compact />
            </section>
          </div>
          {data.artists.length > 0 && <section><SectionTitle>Artists</SectionTitle><div className="flex gap-1 overflow-x-auto">{data.artists.slice(0, 8).map((a) => <ArtistCard key={a.id} artist={a} />)}</div></section>}
          {data.playlists.length > 0 && <section><SectionTitle>Playlists</SectionTitle><div className="flex gap-1 overflow-x-auto">{data.playlists.slice(0, 8).map((c) => <CollectionCard key={c.id} c={c} />)}</div></section>}
          {data.tracks.length > 5 && <section><SectionTitle>More songs</SectionTitle><CardGrid>{data.tracks.slice(5, 23).map((t) => <TrackCard key={t.id} track={t} context={data.tracks} label={`Search: ${q}`} />)}</CardGrid></section>}
        </>
      )}

      {data && type === 'tracks' && (
        <section>
          <div className="mb-4 flex items-center gap-4">
            <PlayButton onClick={() => playTracks(data.tracks, 0, `Search: ${q}`)} />
            <select value={genre ?? ''} onChange={(e) => setParams((p) => { e.target.value ? p.set('genre', e.target.value) : p.delete('genre'); return p; })} className="rounded-full bg-elevated px-4 py-2 text-sm">
              <option value="">All genres</option>{genres?.genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <TrackList tracks={data.tracks} label={`Search: ${q}`} showPlays />
        </section>
      )}
      {data && type === 'artists' && <CardGrid>{data.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</CardGrid>}
      {data && type === 'playlists' && <CardGrid>{data.playlists.map((c) => <CollectionCard key={c.id} c={c} />)}</CardGrid>}

      {data && !data.tracks.length && !data.artists.length && !data.playlists.length && (
        <Empty icon={<SearchIcon className="h-12 w-12" />} title={`No results for “${q}”`} body="Check the spelling or try a different artist, song or tag." />
      )}
    </div>
  );
}

export function GenrePage() {
  const { genre = '' } = useParamsSafe();
  const { data, isLoading } = useQuery({ queryKey: ['trending', genre], queryFn: () => get<{ tracks: SearchResult['tracks'] }>('/api/catalog/trending', { genre, time: 'month', limit: 60 }) });
  const { playTracks } = usePlayer();
  return (
    <div className="fade-up">
      <div className="-mx-6 -mt-16 mb-6 px-6 pb-8 pt-28" style={{ background: `linear-gradient(to bottom, hsl(${hueFrom(genre)} 60% 40%), var(--color-surface))` }}>
        <h1 className="text-5xl font-black md:text-7xl">{genre}</h1>
        <p className="mt-2 text-white/80">Trending this month</p>
      </div>
      {isLoading ? <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : data && (
        <>
          <div className="mb-6"><PlayButton size="lg" onClick={() => playTracks(data.tracks, 0, `${genre} trending`)} /></div>
          <TrackList tracks={data.tracks} label={`${genre} trending`} showPlays />
        </>
      )}
    </div>
  );
}

import { useParams } from 'react-router-dom';
function useParamsSafe() { return useParams<{ genre: string }>(); }
