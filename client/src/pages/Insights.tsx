import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrackList } from '../components/TrackList';
import { Btn, Empty, SectionTitle, Skeleton } from '../components/ui';
import { get } from '../lib/api';
import { fmtDurationLong, hueFrom } from '../lib/format';
import type { Insights } from '../lib/types';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';

export function InsightsPage() {
  const { user } = useAuth();
  const { setAuthPrompt } = useUI();
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: () => get<Insights>('/api/library/insights'), enabled: !!user });

  if (!user) return <Empty icon={<BarChart3 className="h-12 w-12" />} title="Your listening, visualized" body="Sign in to see your top songs, artists, genres and total listening time." action={<Btn onClick={() => setAuthPrompt(true)}>Sign in</Btn>} />;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;

  const maxG = Math.max(1, ...data.topGenres.map((g) => g.n));
  const maxA = Math.max(1, ...data.topArtists.map((a) => a.plays));

  return (
    <div className="fade-up space-y-10">
      <div>
        <h1 className="text-3xl font-black">Your insights</h1>
        <p className="text-subtle">Last 30 days, built from your listening history.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Listening time', fmtDurationLong(data.stats.secs)], ['Plays', String(data.stats.plays)], ['Unique songs', String(data.stats.unique_tracks)]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-elevated p-5"><p className="text-sm text-subtle">{l}</p><p className="mt-1 text-3xl font-black">{v}</p></div>
        ))}
      </div>

      {data.stats.plays === 0 ? <Empty icon={<BarChart3 className="h-12 w-12" />} title="No listening data yet" body="Play a few songs and come back — this page fills in as you listen." /> : (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <SectionTitle>Top genres</SectionTitle>
            <div className="space-y-3">
              {data.topGenres.map((g) => (
                <Link key={g.genre} to={`/genre/${encodeURIComponent(g.genre)}`} className="block">
                  <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{g.genre}</span><span className="text-subtle">{g.n} plays</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-highlight"><div className="h-full rounded-full transition-all" style={{ width: `${(g.n / maxG) * 100}%`, background: `hsl(${hueFrom(g.genre)} 70% 55%)` }} /></div>
                </Link>
              ))}
            </div>
            {data.taste.moods.length > 0 && <p className="mt-6 text-sm text-subtle">Your moods: <span className="text-white">{data.taste.moods.join(' · ')}</span></p>}
          </section>
          <section>
            <SectionTitle>Top artists</SectionTitle>
            <ol className="space-y-2">
              {data.topArtists.map((a, i) => (
                <li key={a.id}>
                  <Link to={`/artist/${a.id}`} className="flex items-center gap-3 rounded-md p-2 hover:bg-highlight">
                    <span className="w-6 text-right text-lg font-black text-subtle">{i + 1}</span>
                    <div className="flex-1"><p className="font-semibold">{a.name}</p><div className="mt-1 h-1.5 rounded-full bg-highlight"><div className="h-full rounded-full bg-accent" style={{ width: `${(a.plays / maxA) * 100}%` }} /></div></div>
                    <span className="text-sm text-subtle">{a.plays}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <section className="lg:col-span-2">
            <SectionTitle>Your top songs</SectionTitle>
            <TrackList tracks={data.topTracks} label="Your top songs" showPlays />
          </section>
        </div>
      )}
    </div>
  );
}
