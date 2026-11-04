import { useQuery } from '@tanstack/react-query';
import { Heart, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionBar } from '../components/Hero';
import { inputCls } from '../components/Modals';
import { TrackList } from '../components/TrackList';
import { Btn, Empty, PlayButton, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { fmtDurationLong } from '../lib/format';
import type { Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';

export function LikedPage() {
  const { user, likedIds } = useAuth();
  const nav = useNavigate();
  const { playTracks, current, playing, toggle } = usePlayer();
  const [filter, setFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['likes', likedIds.size], queryFn: () => get<{ tracks: Track[]; totalDuration: number }>('/api/library/likes'), enabled: !!user });
  const tracks = (data?.tracks ?? []).filter((t) => !filter || `${t.title} ${t.artist.name}`.toLowerCase().includes(filter.toLowerCase()));
  const isThis = playing && tracks.some((t) => t.id === current?.id);

  return (
    <div className="fade-up">
      <div className="-mx-6 -mt-16 mb-6 bg-gradient-to-b from-indigo-700 via-indigo-900/60 to-surface px-6 pb-6 pt-24">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
          <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-200 shadow-2xl md:h-56 md:w-56"><Heart className="h-20 w-20 fill-white text-white" /></div>
          <div>
            <p className="text-sm font-semibold">Playlist</p>
            <h1 className="my-2 text-5xl font-black tracking-tight md:text-7xl">Liked Songs</h1>
            <p className="text-sm text-white/80"><span className="font-bold text-white">{user?.displayName}</span> · {data ? `${data.tracks.length} songs, ${fmtDurationLong(data.totalDuration)}` : ''}</p>
          </div>
        </div>
      </div>
      {data && data.tracks.length > 0 && (
        <ActionBar>
          <PlayButton size="lg" playing={isThis} onClick={() => (isThis ? toggle() : playTracks(tracks, 0, 'Liked Songs'))} />
          <div className="relative ml-auto w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find in Liked Songs" className={`${inputCls} pl-9`} /></div>
        </ActionBar>
      )}
      {isLoading ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        : data?.tracks.length === 0 ? <Empty icon={<Heart className="h-12 w-12" />} title="Songs you like will appear here" body="Save songs by tapping the heart icon." action={<Btn onClick={() => nav('/search')}>Find something to like</Btn>} />
        : <TrackList tracks={tracks} label="Liked Songs" showAdded />}
    </div>
  );
}
