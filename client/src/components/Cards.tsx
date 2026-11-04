import clsx from 'clsx';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Artist, Collection, Playlist, Shelf, Track } from '../lib/types';
import { usePlayer } from '../store/player';
import { Cover, PlayButton, SectionTitle } from './ui';

const cardBase = 'group relative flex w-[172px] shrink-0 flex-col gap-3 rounded-lg bg-transparent p-3 transition hover:bg-highlight/70';

export function TrackCard({ track, context, label }: { track: Track; context?: Track[]; label?: string }) {
  const { current, playing, playTrack } = usePlayer();
  const isCurrent = current?.id === track.id;
  return (
    <Link to={`/track/${track.id}`} className={cardBase}>
      <div className="relative">
        <Cover src={track.artwork} alt={track.title} className="aspect-square w-full shadow-lg shadow-black/50" />
        <PlayButton
          playing={isCurrent && playing}
          onClick={() => playTrack(track, context, label)}
          className={clsx('absolute bottom-2 right-2 transition-all', isCurrent && playing ? 'opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100')}
        />
      </div>
      <div className="min-w-0">
        <p className={clsx('line-clamp-1 font-bold', isCurrent && 'text-accent')}>{track.title}</p>
        <p className="line-clamp-2 text-sm text-subtle">{track.artist.name}</p>
      </div>
    </Link>
  );
}

export function ArtistCard({ artist }: { artist: Artist | { id: string; name: string; avatar: string | null } }) {
  return (
    <Link to={`/artist/${artist.id}`} className={cardBase}>
      <Cover src={artist.avatar} alt={artist.name} rounded="rounded-full" className="aspect-square w-full shadow-lg shadow-black/50" seed={artist.id} />
      <div>
        <p className="line-clamp-1 font-bold">{artist.name}</p>
        <p className="text-sm text-subtle">Artist</p>
      </div>
    </Link>
  );
}

export function CollectionCard({ c }: { c: Collection }) {
  return (
    <Link to={`/collection/${c.id}`} className={cardBase}>
      <Cover src={c.artwork} alt={c.name} className="aspect-square w-full shadow-lg shadow-black/50" seed={c.id} />
      <div>
        <p className="line-clamp-1 font-bold">{c.name}</p>
        <p className="line-clamp-2 text-sm text-subtle">{c.isAlbum ? 'Album' : 'Playlist'} · {c.owner.name}</p>
      </div>
    </Link>
  );
}

export function PlaylistCard({ p }: { p: Playlist }) {
  const nav = useNavigate();
  return (
    <button onClick={() => nav(`/playlist/${p.id}`)} className={clsx(cardBase, 'text-left')}>
      <Cover src={p.artwork} mosaic={p.mosaic} alt={p.name} seed={p.id} className="aspect-square w-full shadow-lg shadow-black/50" />
      <div>
        <p className="line-clamp-1 font-bold">{p.name}</p>
        <p className="line-clamp-2 text-sm text-subtle">{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</p>
      </div>
    </button>
  );
}

export function ShelfRow({ shelf }: { shelf: Shelf }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth - 160), behavior: 'smooth' });
  return (
    <section className="fade-up">
      <SectionTitle
        subtitle={shelf.subtitle}
        action={
          <div className="hidden gap-1 md:flex">
            <button onClick={() => scroll(-1)} className="rounded-full bg-elevated p-1.5 text-subtle hover:text-white" aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => scroll(1)} className="rounded-full bg-elevated p-1.5 text-subtle hover:text-white" aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      >
        {shelf.title}
      </SectionTitle>
      <div ref={ref} className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shelf.kind === 'tracks' && (shelf.items as Track[]).map((t) => <TrackCard key={t.id} track={t} context={shelf.items as Track[]} label={shelf.title} />)}
        {shelf.kind === 'artists' && (shelf.items as Artist[]).map((a) => <ArtistCard key={a.id} artist={a} />)}
        {shelf.kind === 'collections' && (shelf.items as Collection[]).map((c) => <CollectionCard key={c.id} c={c} />)}
      </div>
    </section>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1">{children}</div>;
}
