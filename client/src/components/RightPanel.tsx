import clsx from 'clsx';
import { ExternalLink, Heart, Radio, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtCount, fmtDate } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';
import { TrackMenu } from './TrackList';
import { Btn, Cover, Equalizer } from './ui';

export function RightPanel() {
  const { rightPanel, setRightPanel } = useUI();
  if (!rightPanel) return null;
  return (
    <aside className="hidden h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex gap-4 text-sm font-bold">
          <button onClick={() => setRightPanel('now')} className={clsx(rightPanel === 'now' ? 'text-white' : 'text-subtle hover:text-white')}>Now playing</button>
          <button onClick={() => setRightPanel('queue')} className={clsx(rightPanel === 'queue' ? 'text-white' : 'text-subtle hover:text-white')}>Queue</button>
        </div>
        <button onClick={() => setRightPanel(null)} aria-label="Close" className="rounded-full p-1 text-subtle hover:bg-highlight hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{rightPanel === 'queue' ? <Queue /> : <NowPlaying />}</div>
    </aside>
  );
}

function Queue() {
  const p = usePlayer();
  const up = p.upcoming();
  return (
    <div className="space-y-5">
      {p.current && (
        <section>
          <h3 className="mb-2 text-sm font-bold">Now playing</h3>
          <Row track={p.current} active />
        </section>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">{p.contextLabel ? `Next from: ${p.contextLabel}` : 'Next up'}</h3>
          {up.length > 0 && <button onClick={p.clearQueue} className="text-xs font-bold text-subtle hover:text-white">Clear</button>}
        </div>
        {up.length === 0 ? <p className="text-sm text-faint">Queue is empty. Add songs with “Add to queue”.</p> : up.map(({ track, orderPos }) => <Row key={`${track.id}-${orderPos}`} track={track} onClick={() => p.jumpTo(orderPos)} onRemove={() => p.removeFromQueue(p.order[orderPos])} />)}
      </section>
    </div>
  );
}

function Row({ track, active, onClick, onRemove }: { track: Parameters<typeof TrackMenu>[0]['track']; active?: boolean; onClick?: () => void; onRemove?: () => void }) {
  const { playing } = usePlayer();
  return (
    <div onDoubleClick={onClick} className="group flex items-center gap-3 rounded-md p-2 hover:bg-highlight">
      <button onClick={onClick} className="relative shrink-0" aria-label="Play"><Cover src={track.artwork} alt="" className="h-12 w-12" rounded="rounded" seed={track.id} />
        {active && playing && <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40"><Equalizer /></span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('line-clamp-1 font-medium', active && 'text-accent')}>{track.title}</p>
        <p className="line-clamp-1 text-sm text-subtle">{track.artist.name}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        {onRemove && <button onClick={onRemove} className="rounded-full p-1 text-subtle hover:text-white" aria-label="Remove from queue"><X className="h-4 w-4" /></button>}
        <TrackMenu track={track} />
      </div>
    </div>
  );
}

function NowPlaying() {
  const { current: t, playRadio } = usePlayer();
  const { user, likedIds, toggleLike, followedIds, toggleFollow } = useAuth();
  const { toast, setAuthPrompt } = useUI();
  if (!t) return <p className="text-sm text-faint">Play something to see it here.</p>;
  const liked = likedIds.has(t.id);
  const following = followedIds.has(t.artist.id);
  return (
    <div className="fade-up space-y-5">
      <Cover src={t.artworkLarge ?? t.artwork} alt={t.title} className="aspect-square w-full shadow-2xl shadow-black/60" seed={t.id} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/track/${t.id}`} className="line-clamp-2 text-2xl font-extrabold hover:underline">{t.title}</Link>
          <Link to={`/artist/${t.artist.id}`} className="text-subtle hover:text-white hover:underline">{t.artist.name}</Link>
        </div>
        <button onClick={async () => { if (!user) return setAuthPrompt(true); const l = await toggleLike(t.id); toast(l ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }} className={clsx('mt-1 shrink-0', liked ? 'text-accent' : 'text-subtle hover:text-white')} aria-label="Like">
          <Heart className={clsx('h-6 w-6', liked && 'fill-current')} />
        </button>
      </div>

      <div className="rounded-lg bg-elevated p-4">
        <div className="flex items-center gap-3">
          <Cover src={t.artist.avatar} alt="" rounded="rounded-full" className="h-16 w-16" seed={t.artist.id} />
          <div className="min-w-0 flex-1">
            <Link to={`/artist/${t.artist.id}`} className="font-bold hover:underline">{t.artist.name}</Link>
            <p className="text-sm text-subtle">{t.artist.verified ? 'Verified artist' : 'Artist'}</p>
          </div>
          <button onClick={async () => { if (!user) return setAuthPrompt(true); const f = await toggleFollow(t.artist.id); toast(f ? `Following ${t.artist.name}` : `Unfollowed ${t.artist.name}`); }} className={clsx('rounded-full border px-3 py-1 text-sm font-bold', following ? 'border-white' : 'border-faint hover:border-white')}>
            {following ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-elevated p-4 text-sm">
        <h4 className="mb-2 font-bold">About this song</h4>
        <dl className="grid grid-cols-2 gap-y-1 text-subtle">
          {t.genre && <><dt>Genre</dt><dd className="text-white">{t.genre}</dd></>}
          {t.mood && <><dt>Mood</dt><dd className="text-white">{t.mood}</dd></>}
          {t.bpm && <><dt>BPM</dt><dd className="text-white">{Math.round(t.bpm)}</dd></>}
          <dt>Plays</dt><dd className="text-white">{fmtCount(t.playCount)}</dd>
          <dt>Likes</dt><dd className="text-white">{fmtCount(t.favoriteCount)}</dd>
          {t.releaseDate && <><dt>Released</dt><dd className="text-white">{fmtDate(t.releaseDate)}</dd></>}
        </dl>
        {t.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{t.tags.slice(0, 8).map((tag) => <Link key={tag} to={`/search?q=${encodeURIComponent(tag)}`} className="rounded-full bg-highlight px-2 py-0.5 text-xs hover:bg-press">#{tag}</Link>)}</div>}
      </div>

      <div className="flex gap-2">
        <Btn variant="outline" className="flex-1" onClick={() => void playRadio(t)}><Radio className="h-4 w-4" />Start radio</Btn>
        {t.permalink && <a href={t.permalink} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-full border border-faint px-4 hover:border-white" aria-label="Open on Audius"><ExternalLink className="h-4 w-4" /></a>}
      </div>
    </div>
  );
}
