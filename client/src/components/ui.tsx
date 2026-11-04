import clsx from 'clsx';
import { Music2, Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { hueFrom } from '../lib/format';

export function Cover({ src, alt = '', className, rounded = 'rounded-md', seed, mosaic }: { src?: string | null; alt?: string; className?: string; rounded?: string; seed?: string; mosaic?: string[] }) {
  if (!src && mosaic && mosaic.length >= 4) {
    return (
      <div className={clsx('grid grid-cols-2 grid-rows-2 overflow-hidden bg-elevated', rounded, className)}>
        {mosaic.slice(0, 4).map((m, i) => <img key={i} src={m} alt="" className="h-full w-full object-cover" loading="lazy" />)}
      </div>
    );
  }
  if (src) return <img src={src} alt={alt} loading="lazy" className={clsx('object-cover bg-elevated', rounded, className)} />;
  const h = hueFrom(seed ?? alt);
  return (
    <div className={clsx('flex items-center justify-center text-white/70', rounded, className)} style={{ background: `linear-gradient(135deg, hsl(${h} 60% 35%), hsl(${(h + 50) % 360} 60% 20%))` }}>
      <Music2 className="h-[38%] w-[38%]" />
    </div>
  );
}

export function PlayButton({ playing, onClick, size = 'md', className }: { playing?: boolean; onClick: (e: React.MouseEvent) => void; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-14 w-14' }[size];
  const ic = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }[size];
  return (
    <button
      aria-label={playing ? 'Pause' : 'Play'}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(e); }}
      className={clsx('flex items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 transition hover:scale-105 hover:bg-accent-strong active:scale-100', sz, className)}
    >
      {playing ? <Pause className={clsx(ic, 'fill-current')} /> : <Play className={clsx(ic, 'ml-0.5 fill-current')} />}
    </button>
  );
}

export function Btn({ variant = 'primary', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-[.98]',
        variant === 'primary' && 'bg-accent text-black hover:bg-accent-strong hover:scale-[1.03]',
        variant === 'ghost' && 'text-subtle hover:text-white',
        variant === 'outline' && 'border border-faint text-white hover:border-white hover:scale-[1.03]',
        variant === 'danger' && 'bg-danger/90 text-white hover:bg-danger',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({ className, active, label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string }) {
  return (
    <button {...rest} aria-label={label} title={label} className={clsx('rounded-full p-2 transition hover:text-white hover:scale-105 active:scale-95', active ? 'text-accent' : 'text-subtle', className)}>
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-md', className)} />;
}

export function SectionTitle({ children, action, subtitle }: { children: ReactNode; action?: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight hover:underline">{children}</h2>
        {subtitle && <p className="text-sm text-subtle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Equalizer({ paused }: { paused?: boolean }) {
  return (
    <span className={clsx('eq flex h-4 items-end gap-[2px]', paused && 'paused')} aria-hidden>
      <span /><span /><span />
    </span>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-full font-bold text-black" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="text-faint">{icon}</div>
      <h3 className="text-xl font-bold">{title}</h3>
      {body && <p className="max-w-sm text-sm text-subtle">{body}</p>}
      {action}
    </div>
  );
}
