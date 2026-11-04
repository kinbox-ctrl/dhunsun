import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Playlist } from '../lib/types';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Btn, Cover } from './ui';

function Modal({ title, onClose, children, width = 'max-w-md' }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={clsx('fade-up w-full rounded-xl bg-highlight p-6 shadow-2xl', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-subtle hover:bg-press hover:text-white"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export const inputCls = 'w-full rounded-md border border-faint/60 bg-elevated px-3 py-2.5 text-sm outline-none transition focus:border-white';

export function Toasts() {
  const { toasts } = useUI();
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={clsx('fade-up rounded-md px-4 py-2.5 text-sm font-semibold shadow-xl', t.kind === 'error' ? 'bg-danger text-white' : 'bg-accent text-black')}>{t.message}</div>
      ))}
    </div>
  );
}

export function CreatePlaylistModal() {
  const { createPlaylistOpen, setCreatePlaylistOpen, toast } = useUI();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [pub, setPub] = useState(false);
  const m = useMutation({
    mutationFn: () => post<{ playlist: Playlist }>('/api/library/playlists', { name, description: desc, isPublic: pub }),
    onSuccess: ({ playlist }) => { void qc.invalidateQueries({ queryKey: ['playlists'] }); setCreatePlaylistOpen(false); setName(''); setDesc(''); toast('Playlist created'); nav(`/playlist/${playlist.id}`); },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  if (!createPlaylistOpen) return null;
  return (
    <Modal title="New playlist" onClose={() => setCreatePlaylistOpen(false)}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(); }} className="space-y-3">
        <input autoFocus className={inputCls} placeholder="Playlist name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <textarea className={clsx(inputCls, 'h-20 resize-none')} placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
        <label className="flex items-center gap-2 text-sm text-subtle"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} className="accent-accent" />Public — anyone with the link can view</label>
        <div className="flex justify-end gap-2 pt-2"><Btn type="button" variant="ghost" onClick={() => setCreatePlaylistOpen(false)}>Cancel</Btn><Btn type="submit" disabled={!name.trim() || m.isPending}>Create</Btn></div>
      </form>
    </Modal>
  );
}

export function AddToPlaylistModal() {
  const { addToPlaylistTrack: track, closeAddToPlaylist, toast } = useUI();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const { data } = useQuery({ queryKey: ['playlists'], queryFn: () => get<{ playlists: Playlist[] }>('/api/library/playlists'), enabled: !!track });
  const { data: detail } = useQuery({ queryKey: ['track', track?.id], queryFn: () => get<{ inPlaylists: string[] }>(`/api/catalog/tracks/${track!.id}`), enabled: !!track });
  const add = useMutation({
    mutationFn: async (playlistId: string) => post(`/api/library/playlists/${playlistId}/tracks`, { trackIds: [track!.id] }),
    onSuccess: (_d, id) => { void qc.invalidateQueries({ queryKey: ['playlists'] }); void qc.invalidateQueries({ queryKey: ['playlist', id] }); void qc.invalidateQueries({ queryKey: ['track', track?.id] }); toast(`Added to ${data?.playlists.find((p) => p.id === id)?.name ?? 'playlist'}`); closeAddToPlaylist(); },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  const createAndAdd = useMutation({
    mutationFn: async () => { const { playlist } = await post<{ playlist: Playlist }>('/api/library/playlists', { name: newName }); await post(`/api/library/playlists/${playlist.id}/tracks`, { trackIds: [track!.id] }); return playlist; },
    onSuccess: (p) => { void qc.invalidateQueries({ queryKey: ['playlists'] }); toast(`Created “${p.name}”`); setNewName(''); closeAddToPlaylist(); },
  });
  if (!track) return null;
  const list = (data?.playlists ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Add to playlist" onClose={closeAddToPlaylist}>
      <div className="mb-3 flex items-center gap-3 rounded-md bg-elevated p-2"><Cover src={track.artwork} alt="" className="h-10 w-10" rounded="rounded" seed={track.id} /><div className="min-w-0"><p className="line-clamp-1 text-sm font-semibold">{track.title}</p><p className="line-clamp-1 text-xs text-subtle">{track.artist.name}</p></div></div>
      <div className="relative mb-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a playlist" className={clsx(inputCls, 'pl-9')} /></div>
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        {list.map((p) => { const has = detail?.inPlaylists.includes(p.id); return (
          <button key={p.id} disabled={has || add.isPending} onClick={() => add.mutate(p.id)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-press disabled:opacity-60">
            <Cover src={p.artwork} mosaic={p.mosaic} alt="" seed={p.id} className="h-10 w-10" rounded="rounded" />
            <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-medium">{p.name}</p><p className="text-xs text-subtle">{p.trackCount} songs</p></div>
            {has && <Check className="h-4 w-4 text-accent" />}
          </button>); })}
        {list.length === 0 && <p className="p-3 text-center text-sm text-faint">No playlists match.</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createAndAdd.mutate(); }} className="mt-3 flex gap-2 border-t border-white/10 pt-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist name" className={inputCls} maxLength={80} />
        <Btn type="submit" disabled={!newName.trim() || createAndAdd.isPending} className="shrink-0"><Plus className="h-4 w-4" />Create</Btn>
      </form>
    </Modal>
  );
}

export function AuthPrompt() {
  const { authPrompt, setAuthPrompt } = useUI();
  const { user } = useAuth();
  const nav = useNavigate();
  if (!authPrompt || user) return null;
  return (
    <Modal title="Sign in to continue" onClose={() => setAuthPrompt(false)}>
      <p className="mb-5 text-sm text-subtle">Save songs, build playlists, follow artists, and get recommendations that follow you across devices.</p>
      <div className="flex flex-col gap-2">
        <Btn onClick={() => { setAuthPrompt(false); nav('/auth?mode=login'); }}>Log in</Btn>
        <Btn variant="outline" onClick={() => { setAuthPrompt(false); nav('/auth?mode=register'); }}>Create a free account</Btn>
      </div>
    </Modal>
  );
}
