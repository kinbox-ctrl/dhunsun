import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Heart, Library as LibIcon, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArtistCard, CardGrid, PlaylistCard } from '../components/Cards';
import { Btn, Empty, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import type { Playlist } from '../lib/types';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';

export function LibraryPage() {
  const { user, likedIds } = useAuth();
  const { setCreatePlaylistOpen, setAuthPrompt } = useUI();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'playlists';
  const { data: pl, isLoading } = useQuery({ queryKey: ['playlists'], queryFn: () => get<{ playlists: Playlist[] }>('/api/library/playlists'), enabled: !!user });
  const { data: fl } = useQuery({ queryKey: ['follows'], queryFn: () => get<{ artists: { id: string; name: string; avatar: string | null }[] }>('/api/library/follows'), enabled: !!user });

  if (!user) return <Empty icon={<LibIcon className="h-12 w-12" />} title="Your library lives here" body="Sign in to see your playlists, liked songs and followed artists." action={<Btn onClick={() => setAuthPrompt(true)}>Sign in</Btn>} />;

  return (
    <div className="fade-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Your Library</h1>
        <Btn onClick={() => setCreatePlaylistOpen(true)}><Plus className="h-4 w-4" />New playlist</Btn>
      </div>
      <div className="mb-6 flex gap-2">
        {[['playlists', 'Playlists'], ['artists', 'Artists']].map(([k, l]) => <button key={k} onClick={() => setParams({ tab: k })} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold', tab === k ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20')}>{l}</button>)}
      </div>
      {tab === 'playlists' && (
        isLoading ? <CardGrid>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[.8]" />)}</CardGrid> : (
          <CardGrid>
            <Link to="/liked" className="group flex w-[172px] flex-col gap-3 rounded-lg p-3 transition hover:bg-highlight/70">
              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-200 shadow-lg"><Heart className="h-12 w-12 fill-white text-white" /></div>
              <div><p className="font-bold">Liked Songs</p><p className="text-sm text-subtle">{likedIds.size} songs</p></div>
            </Link>
            {pl?.playlists.map((p) => <PlaylistCard key={p.id} p={p} />)}
          </CardGrid>
        )
      )}
      {tab === 'artists' && (fl?.artists.length ? <CardGrid>{fl.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</CardGrid> : <Empty icon={<LibIcon className="h-12 w-12" />} title="Follow your first artist" body="Followed artists shape your recommendations." />)}
    </div>
  );
}
