import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Player } from './Player';
import { RightPanel } from './RightPanel';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AddToPlaylistModal, AuthPrompt, CreatePlaylistModal, Toasts } from './Modals';
import { Home, Library, Search, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

export function Layout() {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [loc.pathname]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 gap-2 p-2 pb-0">
        <Sidebar />
        <main ref={ref} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)} className="relative min-w-0 flex-1 overflow-y-auto rounded-lg bg-surface">
          <TopBar scrolled={scrolled} />
          <div className="px-6 pb-28 pt-2 md:pb-10">
            <Outlet />
          </div>
        </main>
        <RightPanel />
      </div>
      <Player />
      <nav className="fixed bottom-[88px] left-0 right-0 z-20 flex justify-around border-t border-white/5 bg-base/95 py-2 backdrop-blur md:hidden">
        {[['/', 'Home', Home], ['/search', 'Search', Search], ['/library', 'Library', Library], ['/insights', 'Insights', BarChart3]].map(([to, label, Icon]) => {
          const I = Icon as typeof Home;
          return <NavLink key={to as string} to={to as string} end={to === '/'} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-white' : 'text-subtle')}><I className="h-6 w-6" />{label as string}</NavLink>;
        })}
      </nav>
      <Toasts />
      <CreatePlaylistModal />
      <AddToPlaylistModal />
      <AuthPrompt />
    </div>
  );
}
