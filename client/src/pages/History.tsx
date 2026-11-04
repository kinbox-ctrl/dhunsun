import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Trash2 } from 'lucide-react';
import { ActionBar } from '../components/Hero';
import { TrackList } from '../components/TrackList';
import { Btn, Empty, PlayButton, Skeleton } from '../components/ui';
import { del, get } from '../lib/api';
import type { Track } from '../lib/types';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';

export function HistoryPage() {
  const qc = useQueryClient();
  const { toast } = useUI();
  const { playTracks } = usePlayer();
  const { data, isLoading } = useQuery({ queryKey: ['history'], queryFn: () => get<{ tracks: Track[] }>('/api/library/history') });
  const clear = useMutation({ mutationFn: () => del('/api/library/history'), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['history'] }); void qc.invalidateQueries({ queryKey: ['home'] }); toast('History cleared'); } });
  const tracks = data?.tracks ?? [];
  return (
    <div className="fade-up">
      <div className="-mx-6 -mt-16 mb-6 bg-gradient-to-b from-fuchsia-800/80 to-surface px-6 pb-6 pt-24">
        <p className="text-sm font-semibold">Your activity</p>
        <h1 className="my-2 text-5xl font-black tracking-tight md:text-7xl">Recently played</h1>
        <p className="text-sm text-white/80">{tracks.length} songs · powers your recommendations</p>
      </div>
      {tracks.length > 0 && (
        <ActionBar>
          <PlayButton size="lg" onClick={() => playTracks(tracks, 0, 'Recently played')} />
          <Btn variant="ghost" onClick={() => { if (confirm('Clear your listening history?')) clear.mutate(); }}><Trash2 className="h-4 w-4" />Clear history</Btn>
        </ActionBar>
      )}
      {isLoading ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        : tracks.length === 0 ? <Empty icon={<History className="h-12 w-12" />} title="Nothing played yet" body="Songs you listen to show up here and shape your Made for you shelf." />
        : <TrackList tracks={tracks} label="Recently played" showLastPlayed />}
    </div>
  );
}
