import clsx from 'clsx';
import { ChevronLeft, ChevronRight, LogOut, PanelLeft, Search, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Avatar } from './ui';

export function TopBar({ scrolled }: { scrolled: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const { setAuthPrompt, toggleSidebar, toast } = useUI();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [menu, setMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearch = loc.pathname === '/search';

  useEffect(() => { if (onSearch) setQ(params.get('q') ?? ''); }, [params, onSearch]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); nav('/search'); setTimeout(() => inputRef.current?.focus(), 50); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [nav]);

  // Debounced navigation while typing.
  useEffect(() => {
    if (!onSearch) return;
    const t = setTimeout(() => { const cur = params.get('q') ?? ''; if (q !== cur) nav(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [q, onSearch, nav, params]);

  return (
    <header className={clsx('sticky top-0 z-20 flex h-16 items-center gap-3 px-6 transition-colors', scrolled ? 'bg-surface/95 backdrop-blur' : 'bg-transparent')}>
      <button onClick={toggleSidebar} className="hidden rounded-full bg-black/60 p-2 text-subtle hover:text-white md:block" aria-label="Toggle sidebar"><PanelLeft className="h-4 w-4" /></button>
      <button onClick={() => nav(-1)} className="rounded-full bg-black/60 p-1.5 text-subtle hover:text-white" aria-label="Back"><ChevronLeft className="h-5 w-5" /></button>
      <button onClick={() => nav(1)} className="rounded-full bg-black/60 p-1.5 text-subtle hover:text-white" aria-label="Forward"><ChevronRight className="h-5 w-5" /></button>

      <form onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`); }} className="relative ml-2 w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (!onSearch) nav('/search'); }}
          placeholder="What do you want to play?  ⌘K"
          className="h-11 w-full rounded-full bg-elevated pl-10 pr-9 text-sm text-white outline-none ring-white/60 placeholder:text-faint hover:bg-highlight focus:ring-2"
        />
        {q && <button type="button" onClick={() => { setQ(''); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-white" aria-label="Clear"><X className="h-4 w-4" /></button>}
      </form>

      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="rounded-full bg-black/60 p-1 transition hover:scale-105" aria-label="Account"><Avatar name={user.displayName} color={user.avatarColor} /></button>
            {menu && (
              <div className="fade-up absolute right-0 mt-2 w-52 rounded-md bg-highlight p-1 shadow-2xl" onMouseLeave={() => setMenu(false)}>
                <div className="px-3 py-2"><p className="font-bold">{user.displayName}</p><p className="text-xs text-subtle">@{user.username}</p></div>
                <button onClick={() => { setMenu(false); nav('/settings'); }} className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-press"><Settings className="h-4 w-4" />Settings</button>
                <button onClick={async () => { setMenu(false); await logout(); toast('Signed out'); nav('/'); }} className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm hover:bg-press"><LogOut className="h-4 w-4" />Log out</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={() => nav('/auth?mode=register')} className="hidden px-3 py-2 text-sm font-bold text-subtle hover:text-white sm:block">Sign up</button>
            <button onClick={() => setAuthPrompt(true)} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:scale-105">Log in</button>
          </>
        )}
      </div>
    </header>
  );
}
