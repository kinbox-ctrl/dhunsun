import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ShelfRow } from '../components/Cards';
import { Cover, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { greeting } from '../lib/format';
import type { Shelf, Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';

export function HomePage() {
  const { user } = useAuth();
  const { playTracks } = usePlayer();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['home', user?.id ?? 'anon'], queryFn: () => get<{ shelves: Shelf[] }>('/api/catalog/home'), staleTime: 5 * 60_000 });

  const quick = (data?.shelves.find((s) => s.id === 'recent' || s.id === 'made-for-you' || s.id === 'trending')?.items as Track[] | undefined)?.slice(0, 8) ?? [];

  return (
    <div className="space-y-10">
      <section className="fade-up">
        <h1 className="mb-4 text-3xl font-black tracking-tight">{greeting()}{user ? `, ${user.displayName.split(' ')[0]}` : ''}</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quick.map((t) => (
              <Link key={t.id} to={`/track/${t.id}`} className="group flex items-center gap-3 overflow-hidden rounded bg-white/10 pr-3 transition hover:bg-white/20">
                <Cover src={t.artwork} alt="" className="h-16 w-16 shrink-0" rounded="rounded-l" seed={t.id} />
                <span className="line-clamp-2 flex-1 text-sm font-bold">{t.title}</span>
                <button aria-label="Play" onClick={(e) => { e.preventDefault(); playTracks(quick, quick.indexOf(t), 'Quick picks'); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-black opacity-0 shadow-lg transition group-hover:opacity-100 hover:scale-105"><Play className="ml-0.5 h-4 w-4 fill-current" /></button>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isLoading && Array.from({ length: 3 }).map((_, i) => (
        <section key={i}><Skeleton className="mb-4 h-7 w-56" /><div className="flex gap-4">{Array.from({ length: 6 }).map((_, j) => <div key={j} className="w-[172px] shrink-0 space-y-2 p-3"><Skeleton className="aspect-square w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}</div></section>
      ))}

      {isError && <div className="rounded-lg bg-elevated p-6 text-center"><p className="mb-3 text-subtle">Couldn't load the catalog right now.</p><button onClick={() => refetch()} className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black">Retry</button></div>}

      {data?.shelves.map((s) => <ShelfRow key={s.id} shelf={s} />)}
    </div>
  );
}
