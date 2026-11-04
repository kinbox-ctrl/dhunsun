import { hueFrom } from '../lib/format';
import { Cover } from './ui';

export function Hero({ kind, title, meta, image, mosaic, seed, round, children }: { kind: string; title: string; meta: React.ReactNode; image?: string | null; mosaic?: string[]; seed: string; round?: boolean; children?: React.ReactNode }) {
  const h = hueFrom(seed);
  return (
    <div className="-mx-6 -mt-16 mb-6 px-6 pb-6 pt-24" style={{ background: `linear-gradient(to bottom, hsl(${h} 45% 32%) 0%, hsl(${h} 35% 16%) 70%, var(--color-surface) 100%)` }}>
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
        <Cover src={image} mosaic={mosaic} alt={title} seed={seed} rounded={round ? 'rounded-full' : 'rounded-md'} className="h-48 w-48 shrink-0 shadow-2xl shadow-black/60 md:h-56 md:w-56" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{kind}</p>
          <h1 className="my-2 line-clamp-2 text-4xl font-black tracking-tight md:text-6xl lg:text-7xl">{title}</h1>
          {children}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-white/80">{meta}</div>
        </div>
      </div>
    </div>
  );
}

export function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 flex items-center gap-5">{children}</div>;
}
