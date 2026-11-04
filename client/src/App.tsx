import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ArtistPage } from './pages/Artist';
import { AuthPage } from './pages/Auth';
import { CollectionPage } from './pages/Collection';
import { HistoryPage } from './pages/History';
import { HomePage } from './pages/Home';
import { InsightsPage } from './pages/Insights';
import { LibraryPage } from './pages/Library';
import { LikedPage } from './pages/Liked';
import { PlaylistPage } from './pages/Playlist';
import { GenrePage, SearchPage } from './pages/Search';
import { SettingsPage } from './pages/Settings';
import { TrackPage } from './pages/Track';
import { useAuth } from './store/auth';
import { usePlayer } from './store/player';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

export default function App() {
  const { bootstrap, ready } = useAuth();
  const restore = usePlayer((s) => s.restore);
  useEffect(() => { void bootstrap(); void restore(); }, [bootstrap, restore]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-xl font-black"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-black"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M7 5v14l12-7z" /></svg></span>Dhunsun</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="genre/:genre" element={<GenrePage />} />
          <Route path="track/:id" element={<TrackPage />} />
          <Route path="artist/:id" element={<ArtistPage />} />
          <Route path="collection/:id" element={<CollectionPage />} />
          <Route path="playlist/:id" element={<PlaylistPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="liked" element={<Protected><LikedPage /></Protected>} />
          <Route path="history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
