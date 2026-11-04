import { useQuery } from '@tanstack/react-query';
import { ListPlus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ActionBar, Hero } from '../components/Hero';
import { TrackList } from '../components/TrackList';
import { Btn, PlayButton, Skeleton } from '../components/ui';
import { get, post } from '../lib/api';
import { fmtCount, fmtDurationLong } from '../lib/format';
import type { Collection, Playlist } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';
import { useQueryClient } from '@tanstack/react-query';

/** A public Audius playlist/album. Users can "save a copy" into their own library. */
export function CollectionPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['collection', id], queryFn: () => get<{ collection: Collection }>(`/api/catalog/collections/${id}`) });
  const { playTracks, current, playing, toggle } = usePlayer();
  const { user } = useAuth();
  const { toast, setAuthPrompt } = useUI();
  const qc = useQueryClient();

  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="-mx-6 -mt-16 h-80 rounded-none" />{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  const c = data.collection;
  const tracks = c.tracks ?? [];
  const isThis = playing && tracks.some((t) => t.id === current?.id);

  const saveCopy = async () => {
    if (!user) return setAuthPrompt(true);
    try {
      const { playlist } = await post<{ playlist: Playlist }>('/api/library/playlists', { name: c.name, description: `Saved from ${c.owner.name}` });
      await post(`/api/library/playlists/${playlist.id}/tracks`, { trackIds: tracks.map((t) => t.id) });
      void qc.invalidateQueries({ queryKey: ['playlists'] });
      toast('Saved to Your Library');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="fade-up">
      <Hero kind={c.isAlbum ? 'Album' : 'Playlist'} title={c.name} image={c.artwork} seed={c.id}
        meta={<><span className="font-bold text-white">{c.owner.name}</span><span>·</span><span>{fmtCount(c.favoriteCount)} likes</span><span>·</span><span>{tracks.length} songs, {fmtDurationLong(tracks.reduce((s, t) => s + t.duration, 0))}</span></>}>
        {c.description && <p className="line-clamp-2 max-w-2xl text-sm text-white/70">{c.description}</p>}
      </Hero>
      <ActionBar>
        <PlayButton size="lg" playing={isThis} onClick={() => (isThis ? toggle() : playTracks(tracks, 0, c.name))} />
        <Btn variant="outline" onClick={saveCopy}><ListPlus className="h-4 w-4" />Save to library</Btn>
      </ActionBar>
      <TrackList tracks={tracks} label={c.name} showPlays />
    </div>
  );
}
