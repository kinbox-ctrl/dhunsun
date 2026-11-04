import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Heart, ListPlus, Radio } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ActionBar, Hero } from '../components/Hero';
import { TrackList, TrackMenu } from '../components/TrackList';
import { Btn, PlayButton, SectionTitle, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { fmtCount, fmtDate, fmtTime } from '../lib/format';
import type { Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';

export function TrackPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['track', id], queryFn: () => get<{ track: Track }>(`/api/catalog/tracks/${id}`) });
  const { data: radio } = useQuery({ queryKey: ['radio', id], queryFn: () => get<{ tracks: Track[] }>(`/api/catalog/tracks/${id}/radio`), enabled: !!data });
  const { playTrack, playRadio, current, playing } = usePlayer();
  const { user, likedIds, toggleLike } = useAuth();
  const { toast, setAuthPrompt, openAddToPlaylist } = useUI();

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="-mx-6 -mt-16 h-80 rounded-none" /><Skeleton className="h-12 w-40" /></div>;
  const t = data.track;
  const liked = likedIds.has(t.id);
  const isCur = current?.id === t.id && playing;
  const more = (radio?.tracks ?? []).filter((x) => x.id !== t.id);

  return (
    <div className="fade-up">
      <Hero kind="Song" title={t.title} image={t.artworkLarge ?? t.artwork} seed={t.id}
        meta={<><Link to={`/artist/${t.artist.id}`} className="font-bold text-white hover:underline">{t.artist.name}</Link><span>·</span><span>{fmtDate(t.releaseDate)}</span><span>·</span><span>{fmtTime(t.duration)}</span><span>·</span><span>{fmtCount(t.playCount)} plays</span></>} />
      <ActionBar>
        <PlayButton size="lg" playing={isCur} onClick={() => playTrack(t, more.length ? [t, ...more] : undefined, `${t.title} Radio`)} />
        <button onClick={async () => { if (!user) return setAuthPrompt(true); const l = await toggleLike(t.id); toast(l ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }} className={clsx(liked ? 'text-accent' : 'text-subtle hover:text-white')} aria-label="Like"><Heart className={clsx('h-8 w-8', liked && 'fill-current')} /></button>
        <button onClick={() => (user ? openAddToPlaylist(t) : setAuthPrompt(true))} className="text-subtle hover:text-white" aria-label="Add to playlist"><ListPlus className="h-7 w-7" /></button>
        <TrackMenu track={t} align="left" />
        <Btn variant="outline" className="ml-auto" onClick={() => void playRadio(t)}><Radio className="h-4 w-4" />Start radio</Btn>
      </ActionBar>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <SectionTitle subtitle="Similar songs, picked for you">Recommended</SectionTitle>
          {radio ? <TrackList tracks={more} label={`${t.title} Radio`} showPlays /> : <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg bg-elevated p-5 text-sm">
            <h3 className="mb-3 font-bold">Details</h3>
            <dl className="grid grid-cols-2 gap-y-1.5 text-subtle">
              {t.genre && <><dt>Genre</dt><dd className="text-white"><Link to={`/genre/${encodeURIComponent(t.genre)}`} className="hover:underline">{t.genre}</Link></dd></>}
              {t.mood && <><dt>Mood</dt><dd className="text-white">{t.mood}</dd></>}
              {t.bpm && <><dt>BPM</dt><dd className="text-white">{Math.round(t.bpm)}</dd></>}
              <dt>Likes</dt><dd className="text-white">{fmtCount(t.favoriteCount)}</dd>
              <dt>Reposts</dt><dd className="text-white">{fmtCount(t.repostCount)}</dd>
            </dl>
            {t.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1">{t.tags.map((tag) => <Link key={tag} to={`/search?q=${encodeURIComponent(tag)}`} className="rounded-full bg-highlight px-2.5 py-1 text-xs hover:bg-press">#{tag}</Link>)}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
