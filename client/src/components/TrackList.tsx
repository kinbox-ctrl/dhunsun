import clsx from 'clsx';
import { Clock, Heart, ListPlus, ListEnd, MoreHorizontal, Play, Radio, Share2, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtCount, fmtTime, timeAgo } from '../lib/format';
import type { Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';
import { Cover, Equalizer } from './ui';

/* ---------------- context menu ---------------- */

export function TrackMenu({ track, onRemove, align = 'right' }: { track: Track; onRemove?: () => void; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { user, likedIds, toggleLike } = useAuth();
  const { addToQueue, playNext, playRadio } = usePlayer();
  const { toast, openAddToPlaylist, setAuthPrompt } = useUI();
  const liked = likedIds.has(track.id);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const needAuth = () => { if (!user) { setAuthPrompt(true); return true; } return false; };
  const items: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }[] = [
    { icon: <ListPlus className="h-4 w-4" />, label: 'Add to playlist', onClick: () => { if (needAuth()) return; openAddToPlaylist(track); } },
    { icon: <Heart className={clsx('h-4 w-4', liked && 'fill-accent text-accent')} />, label: liked ? 'Remove from Liked Songs' : 'Save to Liked Songs', onClick: async () => { if (needAuth()) return; const l = await toggleLike(track.id); toast(l ? 'Added to Liked Songs' : 'Removed from Liked Songs'); } },
    { icon: <ListEnd className="h-4 w-4" />, label: 'Play next', onClick: () => { playNext(track); toast('Will play next'); } },
    { icon: <ListEnd className="h-4 w-4" />, label: 'Add to queue', onClick: () => { addToQueue(track); toast('Added to queue'); } },
    { icon: <Radio className="h-4 w-4" />, label: 'Go to song radio', onClick: () => void playRadio(track) },
    { icon: <User className="h-4 w-4" />, label: 'Go to artist', onClick: () => nav(`/artist/${track.artist.id}`) },
    { icon: <Share2 className="h-4 w-4" />, label: 'Copy link', onClick: () => { void navigator.clipboard.writeText(`${location.origin}/track/${track.id}`); toast('Link copied'); } },
  ];
  if (onRemove) items.push({ icon: <Trash2 className="h-4 w-4" />, label: 'Remove from this playlist', onClick: onRemove, danger: true });

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button aria-label="More options" onClick={() => setOpen((o) => !o)} className={clsx('rounded-full p-1 text-subtle hover:text-white', open && 'text-white')}>
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className={clsx('fade-up absolute z-40 mt-1 w-60 rounded-md bg-highlight p-1 shadow-2xl shadow-black/60', align === 'right' ? 'right-0' : 'left-0')} style={{ animationDuration: '.15s' }}>
          {items.map((it) => (
            <button key={it.label} onClick={() => { setOpen(false); it.onClick(); }} className={clsx('flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm hover:bg-press', it.danger ? 'text-danger' : 'text-white')}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- table ---------------- */

export interface TrackListProps {
  tracks: Track[];
  label?: string;
  showArtwork?: boolean;
  showPlays?: boolean;
  showAdded?: boolean;
  showLastPlayed?: boolean;
  onRemove?: (track: Track) => void;
  onReorder?: (ordered: Track[]) => void;
  compact?: boolean;
}

export function TrackList({ tracks, label, showArtwork = true, showPlays, showAdded, showLastPlayed, onRemove, onReorder, compact }: TrackListProps) {
  const { current, playing, playTrack } = usePlayer();
  const { likedIds, toggleLike, user } = useAuth();
  const { toast, setAuthPrompt } = useUI();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const drop = (to: number) => {
    if (drag === null || drag === to || !onReorder) return;
    const next = [...tracks];
    const [m] = next.splice(drag, 1);
    next.splice(to, 0, m);
    onReorder(next);
    setDrag(null); setOver(null);
  };

  const extraCol = showPlays || showAdded || showLastPlayed;

  return (
    <div className="w-full">
      {!compact && (
        <div className={clsx('sticky top-16 z-10 mb-2 grid items-center gap-4 border-b border-white/10 bg-inherit px-4 py-2 text-xs font-medium uppercase tracking-wider text-subtle', extraCol ? 'grid-cols-[32px_minmax(0,6fr)_minmax(0,3fr)_minmax(0,2fr)_72px]' : 'grid-cols-[32px_minmax(0,6fr)_minmax(0,3fr)_72px]')}>
          <span className="text-center">#</span><span>Title</span><span className="hidden md:block">Genre</span>
          {showPlays && <span className="hidden md:block">Plays</span>}
          {showAdded && <span className="hidden md:block">Date added</span>}
          {showLastPlayed && <span className="hidden md:block">Played</span>}
          <span className="flex justify-end pr-6"><Clock className="h-4 w-4" /></span>
        </div>
      )}
      {tracks.map((t, i) => {
        const isCur = current?.id === t.id;
        const liked = likedIds.has(t.id);
        return (
          <div
            key={`${t.id}-${i}`}
            draggable={!!onReorder}
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => { if (onReorder) { e.preventDefault(); setOver(i); } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => drop(i)}
            onDoubleClick={() => playTrack(t, tracks, label)}
            className={clsx(
              'group grid cursor-default items-center gap-4 rounded-md px-4 py-2 transition hover:bg-white/10',
              extraCol ? 'grid-cols-[32px_minmax(0,6fr)_minmax(0,3fr)_minmax(0,2fr)_72px]' : 'grid-cols-[32px_minmax(0,6fr)_minmax(0,3fr)_72px]',
              compact && 'grid-cols-[32px_minmax(0,1fr)_72px]',
              over === i && drag !== i && 'border-t-2 border-accent',
            )}
          >
            <div className="flex w-8 items-center justify-center text-sm tabular-nums text-subtle">
              {isCur && playing ? <span className="group-hover:hidden"><Equalizer /></span> : <span className={clsx('group-hover:hidden', isCur && 'text-accent')}>{i + 1}</span>}
              <button aria-label="Play" onClick={() => playTrack(t, tracks, label)} className="hidden text-white group-hover:block"><Play className="h-4 w-4 fill-current" /></button>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              {showArtwork && <Cover src={t.artwork} alt="" className="h-10 w-10 shrink-0" rounded="rounded" seed={t.id} />}
              <div className="min-w-0">
                <Link to={`/track/${t.id}`} className={clsx('line-clamp-1 font-medium hover:underline', isCur && 'text-accent')}>{t.title}</Link>
                <Link to={`/artist/${t.artist.id}`} className="line-clamp-1 text-sm text-subtle hover:text-white hover:underline">{t.artist.name}</Link>
              </div>
            </div>
            {!compact && <span className="line-clamp-1 hidden text-sm text-subtle md:block">{t.genre ?? '—'}</span>}
            {showPlays && <span className="hidden text-sm tabular-nums text-subtle md:block">{fmtCount(t.userPlays ?? t.playCount)}</span>}
            {showAdded && <span className="hidden text-sm text-subtle md:block">{t.addedAt ? timeAgo(t.addedAt) : ''}</span>}
            {showLastPlayed && <span className="hidden text-sm text-subtle md:block">{t.lastPlayed ? timeAgo(t.lastPlayed) : ''}</span>}
            <div className="flex items-center justify-end gap-2">
              <button
                aria-label={liked ? 'Unlike' : 'Like'}
                onClick={async () => { if (!user) return setAuthPrompt(true); const l = await toggleLike(t.id); toast(l ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }}
                className={clsx('transition', liked ? 'text-accent' : 'text-subtle opacity-0 hover:text-white group-hover:opacity-100')}
              >
                <Heart className={clsx('h-4 w-4', liked && 'fill-current')} />
              </button>
              <span className="w-10 text-right text-sm tabular-nums text-subtle">{fmtTime(t.duration)}</span>
              <span className="opacity-0 group-hover:opacity-100"><TrackMenu track={t} onRemove={onRemove ? () => onRemove(t) : undefined} /></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
