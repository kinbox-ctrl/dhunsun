import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Lock, Pencil, Share2, Trash2, ListMusic } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionBar, Hero } from '../components/Hero';
import { inputCls } from '../components/Modals';
import { TrackList } from '../components/TrackList';
import { Btn, Empty, PlayButton, Skeleton } from '../components/ui';
import { del, get, patch, put } from '../lib/api';
import { fmtDurationLong } from '../lib/format';
import type { Playlist, Track } from '../lib/types';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUI } from '../store/ui';

export function PlaylistPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useUI();
  const { playTracks, current, playing, toggle } = usePlayer();
  const { data, isLoading, error } = useQuery({ queryKey: ['playlist', id], queryFn: () => get<{ playlist: Playlist }>(`/api/library/playlists/${id}`) });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', isPublic: false });

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['playlist', id] }); void qc.invalidateQueries({ queryKey: ['playlists'] }); };
  const update = useMutation({ mutationFn: () => patch(`/api/library/playlists/${id}`, form), onSuccess: () => { invalidate(); setEditing(false); toast('Playlist updated'); } });
  const remove = useMutation({ mutationFn: () => del(`/api/library/playlists/${id}`), onSuccess: () => { invalidate(); toast('Playlist deleted'); nav('/library'); } });
  const removeTrack = useMutation({ mutationFn: (t: Track) => del(`/api/library/playlists/${id}/tracks/${t.id}`), onSuccess: () => { invalidate(); toast('Removed from playlist'); } });
  const reorder = useMutation({
    mutationFn: (ordered: Track[]) => put(`/api/library/playlists/${id}/order`, { trackIds: ordered.map((t) => t.id) }),
    onMutate: (ordered) => { qc.setQueryData(['playlist', id], (old: { playlist: Playlist } | undefined) => old && { playlist: { ...old.playlist, tracks: ordered } }); },
    onSettled: invalidate,
  });

  if (error) return <Empty icon={<Lock className="h-12 w-12" />} title="This playlist is private" body="Ask the owner to make it public to share it." />;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="-mx-6 -mt-16 h-80 rounded-none" />{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  const p = data.playlist;
  const tracks = p.tracks ?? [];
  const own = user?.id === p.ownerId;
  const isThis = playing && tracks.some((t) => t.id === current?.id);

  return (
    <div className="fade-up">
      <Hero kind={p.isPublic ? 'Public playlist' : 'Private playlist'} title={p.name} image={p.artwork} mosaic={p.mosaic} seed={p.id}
        meta={<><span className="font-bold text-white">{p.ownerName ?? 'You'}</span><span>·</span><span>{tracks.length} songs{tracks.length ? `, ${fmtDurationLong(p.totalDuration ?? 0)}` : ''}</span></>}>
        {p.description && <p className="text-sm text-white/70">{p.description}</p>}
      </Hero>

      <ActionBar>
        <PlayButton size="lg" playing={isThis} onClick={() => (isThis ? toggle() : playTracks(tracks, 0, p.name))} />
        {own && <button onClick={() => { setForm({ name: p.name, description: p.description, isPublic: p.isPublic }); setEditing(true); }} className="text-subtle hover:text-white" aria-label="Edit details"><Pencil className="h-6 w-6" /></button>}
        <button onClick={() => { void navigator.clipboard.writeText(`${location.origin}/playlist/${p.id}`); toast(p.isPublic ? 'Link copied' : 'Link copied — make it public so others can open it'); }} className="text-subtle hover:text-white" aria-label="Share"><Share2 className="h-6 w-6" /></button>
        {own && <button onClick={() => { if (confirm(`Delete “${p.name}”?`)) remove.mutate(); }} className="text-subtle hover:text-danger" aria-label="Delete"><Trash2 className="h-6 w-6" /></button>}
      </ActionBar>

      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="mb-6 grid gap-3 rounded-lg bg-elevated p-4 md:grid-cols-2">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" maxLength={80} />
          <label className="flex items-center gap-2 text-sm text-subtle">{form.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}<input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="accent-accent" />Public</label>
          <textarea className={`${inputCls} md:col-span-2`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" maxLength={300} />
          <div className="flex justify-end gap-2 md:col-span-2"><Btn type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn><Btn type="submit" disabled={!form.name.trim()}>Save</Btn></div>
        </form>
      )}

      {tracks.length === 0 ? (
        <Empty icon={<ListMusic className="h-12 w-12" />} title="Let's find something for this playlist" body="Search for songs and use “Add to playlist” from the ⋯ menu." action={<Btn onClick={() => nav('/search')}>Search songs</Btn>} />
      ) : (
        <TrackList tracks={tracks} label={p.name} showAdded onRemove={own ? (t) => removeTrack.mutate(t) : undefined} onReorder={own ? (o) => reorder.mutate(o) : undefined} />
      )}
    </div>
  );
}
