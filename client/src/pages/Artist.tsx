import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Radio } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArtistCard } from '../components/Cards';
import { ActionBar } from '../components/Hero';
import { TrackList } from '../components/TrackList';
import { Btn, Cover, PlayButton, SectionTitle, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { fmtCount } from '../lib/format';
import type { Artist, Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';

export function ArtistPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['artist', id], queryFn: () => get<{ artist: Artist; popular: Track[]; latest: Track[]; related: Artist[] }>(`/api/catalog/artists/${id}`) });
  const { playTracks, playRadio, current, playing } = usePlayer();
  const { user, followedIds, toggleFollow } = useAuth();
  const { toast, setAuthPrompt } = useUI();
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<'popular' | 'latest'>('popular');

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="-mx-6 -mt-16 h-80 rounded-none" /><Skeleton className="h-12 w-40" />{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  const { artist: a, popular, latest, related } = data;
  const following = followedIds.has(a.id);
  const list = tab === 'popular' ? popular : latest;
  const isPlayingArtist = playing && list.some((t) => t.id === current?.id);

  return (
    <div className="fade-up">
      <div className="relative -mx-6 -mt-16 mb-6 flex min-h-[340px] items-end overflow-hidden px-6 pb-6 pt-24">
        {a.cover ? <img src={a.cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-b from-indigo-900 to-surface" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/40 to-black/10" />
        <div className="relative flex items-end gap-6">
          {!a.cover && <Cover src={a.avatar} alt={a.name} rounded="rounded-full" className="h-44 w-44 shadow-2xl" seed={a.id} />}
          <div>
            {a.verified && <p className="flex items-center gap-1 text-sm font-semibold"><BadgeCheck className="h-5 w-5 fill-sky-500 text-white" />Verified Artist</p>}
            <h1 className="my-2 text-5xl font-black tracking-tight md:text-7xl">{a.name}</h1>
            <p className="text-white/90">{fmtCount(a.followerCount)} followers · {a.trackCount} tracks{a.location && <span className="inline-flex items-center gap-1"> · <MapPin className="h-3.5 w-3.5" />{a.location}</span>}</p>
          </div>
        </div>
      </div>

      <ActionBar>
        <PlayButton size="lg" playing={isPlayingArtist} onClick={() => (isPlayingArtist ? usePlayer.getState().toggle() : playTracks(list, 0, a.name))} />
        <Btn variant="outline" onClick={async () => { if (!user) return setAuthPrompt(true); const f = await toggleFollow(a.id); toast(f ? `Following ${a.name}` : `Unfollowed ${a.name}`); }} className={clsx(following && 'border-white')}>{following ? 'Following' : 'Follow'}</Btn>
        <button onClick={() => popular[0] && void playRadio(popular[0])} className="flex items-center gap-2 text-sm font-bold text-subtle hover:text-white"><Radio className="h-5 w-5" />Artist radio</button>
      </ActionBar>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          <div className="mb-3 flex gap-2">
            {(['popular', 'latest'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold capitalize', tab === t ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20')}>{t}</button>)}
          </div>
          <TrackList tracks={showAll ? list : list.slice(0, 5)} label={a.name} showPlays showArtwork />
          {list.length > 5 && <button onClick={() => setShowAll((s) => !s)} className="mt-2 px-4 text-sm font-bold text-subtle hover:text-white">{showAll ? 'Show less' : 'See more'}</button>}
        </section>
        {a.bio && (
          <aside className="rounded-lg bg-elevated p-5">
            <h3 className="mb-2 font-bold">About</h3>
            <p className="whitespace-pre-line text-sm text-subtle">{a.bio}</p>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <SectionTitle>Fans also like</SectionTitle>
          <div className="flex gap-1 overflow-x-auto">{related.map((r) => <ArtistCard key={r.id} artist={r} />)}</div>
        </section>
      )}
    </div>
  );
}
