import clsx from 'clsx';
import { Heart, ListMusic, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';
import { Cover, IconBtn } from './ui';

function Slider({ value, max, onChange, className, ariaLabel }: { value: number; max: number; onChange: (v: number) => void; className?: string; ariaLabel: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <input
      type="range" min={0} max={max || 1} step={max > 10 ? 0.5 : 0.01} value={Math.min(value, max || 1)}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={clsx('w-full', className)}
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  );
}

export function Player() {
  const p = usePlayer();
  const { user, likedIds, toggleLike } = useAuth();
  const { rightPanel, setRightPanel, toast, setAuthPrompt } = useUI();
  const t = p.current;
  const liked = t ? likedIds.has(t.id) : false;
  const VolIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;

  return (
    <footer className="grid h-[88px] grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-white/5 bg-base px-4">
      {/* now playing */}
      <div className="flex min-w-0 items-center gap-3">
        {t ? (
          <>
            <button onClick={() => setRightPanel(rightPanel === 'now' ? null : 'now')} className="group relative shrink-0" aria-label="Open now playing">
              <Cover src={t.artwork} alt={t.title} className="h-14 w-14" rounded="rounded" seed={t.id} />
              <span className="absolute inset-0 hidden items-center justify-center rounded bg-black/50 group-hover:flex"><Maximize2 className="h-4 w-4" /></span>
            </button>
            <div className="min-w-0">
              <Link to={`/track/${t.id}`} className="line-clamp-1 text-sm font-semibold hover:underline">{t.title}</Link>
              <Link to={`/artist/${t.artist.id}`} className="line-clamp-1 text-xs text-subtle hover:text-white hover:underline">{t.artist.name}</Link>
            </div>
            <IconBtn label={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'} active={liked} className="hidden sm:block" onClick={async () => { if (!user) return setAuthPrompt(true); const l = await toggleLike(t.id); toast(l ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }}>
              <Heart className={clsx('h-4 w-4', liked && 'fill-current')} />
            </IconBtn>
          </>
        ) : (
          <div className="text-sm text-faint">Nothing playing — pick a song to start.</div>
        )}
      </div>

      {/* controls */}
      <div className="flex w-[min(620px,45vw)] flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <IconBtn label="Shuffle" active={p.shuffle} onClick={p.toggleShuffle}><Shuffle className="h-4 w-4" /></IconBtn>
          <IconBtn label="Previous" onClick={p.prev}><SkipBack className="h-5 w-5 fill-current" /></IconBtn>
          <button aria-label={p.playing ? 'Pause' : 'Play'} onClick={p.toggle} disabled={!t} className="mx-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-100">
            {p.loading && p.playing ? <Loader2 className="h-4 w-4 animate-spin" /> : p.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
          <IconBtn label="Next" onClick={p.next}><SkipForward className="h-5 w-5 fill-current" /></IconBtn>
          <IconBtn label={`Repeat: ${p.repeat}`} active={p.repeat !== 'off'} onClick={p.cycleRepeat}>{p.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</IconBtn>
        </div>
        <div className="flex w-full items-center gap-2 text-[11px] tabular-nums text-subtle">
          <span className="w-10 text-right">{fmtTime(p.time)}</span>
          <Slider value={p.time} max={p.duration} onChange={p.seek} ariaLabel="Seek" />
          <span className="w-10">{fmtTime(p.duration)}</span>
        </div>
      </div>

      {/* right cluster */}
      <div className="flex items-center justify-end gap-1">
        {p.error && <span className="mr-2 hidden text-xs text-danger lg:block">{p.error}</span>}
        <IconBtn label="Queue" active={rightPanel === 'queue'} onClick={() => setRightPanel(rightPanel === 'queue' ? null : 'queue')}><ListMusic className="h-4 w-4" /></IconBtn>
        <div className="hidden items-center gap-1 md:flex">
          <IconBtn label={p.muted ? 'Unmute' : 'Mute'} onClick={p.toggleMute}><VolIcon className="h-4 w-4" /></IconBtn>
          <div className="w-24"><Slider value={p.muted ? 0 : p.volume} max={1} onChange={p.setVolume} ariaLabel="Volume" /></div>
        </div>
      </div>
    </footer>
  );
}
