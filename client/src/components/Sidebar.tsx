import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Heart, History, Home, Library, Plus, Search, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { get } from '../lib/api';
import type { Playlist } from '../lib/types';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Cover } from './ui';

const navCls = ({ isActive }: { isActive: boolean }) => clsx('flex items-center gap-4 rounded-md px-3 py-2 font-bold transition hover:text-white', isActive ? 'text-white' : 'text-subtle');

export function Sidebar() {
  const { user } = useAuth();
  const { setCreatePlaylistOpen, setAuthPrompt, sidebarCollapsed } = useUI();
  const loc = useLocation();
  const { data } = useQuery({ queryKey: ['playlists'], queryFn: () => get<{ playlists: Playlist[] }>('/api/library/playlists'), enabled: !!user });
  const { data: follows } = useQuery({ queryKey: ['follows'], queryFn: () => get<{ artists: { id: string; name: string; avatar: string | null }[] }>('/api/library/follows'), enabled: !!user });

  return (
    <aside className={clsx('hidden h-full flex-col gap-2 md:flex', sidebarCollapsed ? 'w-[88px]' : 'w-[300px]')}>
      <nav className="rounded-lg bg-surface p-3">
        <div className="mb-3 flex items-center gap-2 px-3 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-black"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M7 5v14l12-7z" /></svg></span>
          {!sidebarCollapsed && <span className="text-xl font-black tracking-tight">Dhunsun</span>}
        </div>
        <NavLink to="/" className={navCls} end><Home className="h-6 w-6 shrink-0" />{!sidebarCollapsed && 'Home'}</NavLink>
        <NavLink to="/search" className={navCls}><Search className="h-6 w-6 shrink-0" />{!sidebarCollapsed && 'Search'}</NavLink>
        <NavLink to="/insights" className={navCls}><BarChart3 className="h-6 w-6 shrink-0" />{!sidebarCollapsed && 'Insights'}</NavLink>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
        <div className="flex items-center justify-between px-5 py-3">
          <NavLink to="/library" className={({ isActive }) => clsx('flex items-center gap-3 font-bold transition hover:text-white', isActive ? 'text-white' : 'text-subtle')}>
            <Library className="h-6 w-6" />{!sidebarCollapsed && 'Your Library'}
          </NavLink>
          {!sidebarCollapsed && (
            <button aria-label="Create playlist" onClick={() => (user ? setCreatePlaylistOpen(true) : setAuthPrompt(true))} className="rounded-full p-1.5 text-subtle transition hover:bg-highlight hover:text-white"><Plus className="h-5 w-5" /></button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {user ? (
            <>
              <LibRow to="/liked" active={loc.pathname === '/liked'} collapsed={sidebarCollapsed} title="Liked Songs" sub="Playlist" icon={<div className="flex h-12 w-12 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-emerald-200"><Heart className="h-5 w-5 fill-white text-white" /></div>} />
              <LibRow to="/history" active={loc.pathname === '/history'} collapsed={sidebarCollapsed} title="Recently played" sub="History" icon={<div className="flex h-12 w-12 items-center justify-center rounded bg-gradient-to-br from-fuchsia-600 to-amber-300"><History className="h-5 w-5 text-white" /></div>} />
              {follows?.artists.length ? <LibRow to="/library?tab=artists" active={false} collapsed={sidebarCollapsed} title="Artists you follow" sub={`${follows.artists.length} artists`} icon={<div className="flex h-12 w-12 items-center justify-center rounded bg-gradient-to-br from-sky-600 to-cyan-300"><Users className="h-5 w-5 text-white" /></div>} /> : null}
              {data?.playlists.map((p) => (
                <LibRow key={p.id} to={`/playlist/${p.id}`} active={loc.pathname === `/playlist/${p.id}`} collapsed={sidebarCollapsed} title={p.name} sub={`Playlist · ${p.trackCount} songs`} icon={<Cover src={p.artwork} mosaic={p.mosaic} seed={p.id} alt="" className="h-12 w-12" rounded="rounded" />} />
              ))}
              {data && data.playlists.length === 0 && !sidebarCollapsed && (
                <div className="m-2 rounded-lg bg-elevated p-4">
                  <p className="font-bold">Create your first playlist</p>
                  <p className="mb-3 text-sm text-subtle">It's easy, we'll help you.</p>
                  <button onClick={() => setCreatePlaylistOpen(true)} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black hover:scale-105">Create playlist</button>
                </div>
              )}
            </>
          ) : (
            !sidebarCollapsed && (
              <div className="m-2 rounded-lg bg-elevated p-4">
                <p className="font-bold">Build your library</p>
                <p className="mb-3 text-sm text-subtle">Sign in to save songs, follow artists and make playlists that sync everywhere.</p>
                <button onClick={() => setAuthPrompt(true)} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black hover:scale-105">Sign in</button>
              </div>
            )
          )}
        </div>
      </div>
    </aside>
  );
}

function LibRow({ to, title, sub, icon, active, collapsed }: { to: string; title: string; sub: string; icon: React.ReactNode; active: boolean; collapsed: boolean }) {
  return (
    <NavLink to={to} className={clsx('flex items-center gap-3 rounded-md p-2 transition hover:bg-highlight', active && 'bg-elevated')} title={title}>
      {icon}
      {!collapsed && (
        <div className="min-w-0">
          <p className={clsx('line-clamp-1 font-medium', active && 'text-accent')}>{title}</p>
          <p className="line-clamp-1 text-sm text-subtle">{sub}</p>
        </div>
      )}
    </NavLink>
  );
}
