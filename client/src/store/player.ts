/**
 * Player engine. Owns a single HTMLAudioElement, the queue, playback modes, and
 * side effects: Media Session (lock-screen/keyboard controls), history reporting,
 * local persistence and cross-device sync of the last state.
 */
import { create } from 'zustand';
import { get as apiGet, post, put } from '../lib/api';
import type { RepeatMode, Track } from '../lib/types';
import { useAuth } from './auth';

const audio = new Audio();
audio.preload = 'auto';
audio.crossOrigin = 'anonymous';

interface PlayerState {
  queue: Track[];
  order: number[]; // playback order (indices into queue); identity order unless shuffled
  pos: number; // index into `order`
  current: Track | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  contextLabel: string | null;
  error: string | null;

  playTracks: (tracks: Track[], startIndex?: number, label?: string) => void;
  playTrack: (track: Track, contextTracks?: Track[], label?: string) => void;
  playRadio: (track: Track) => Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (tracks: Track | Track[]) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (queueIndex: number) => void;
  jumpTo: (orderPos: number) => void;
  clearQueue: () => void;
  upcoming: () => { track: Track; orderPos: number }[];
  restore: () => Promise<void>;
}

function shuffled(n: number, keepFirst?: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return keepFirst === undefined ? arr : [keepFirst, ...arr];
}

let playedSeconds = 0;
let lastTick = 0;
let reportedFor: string | null = null;

function reportPlay(track: Track | null, completed: boolean) {
  if (!track || !useAuth.getState().user) return;
  if (playedSeconds < 5 && !completed) return;
  if (reportedFor === track.id && !completed) return;
  reportedFor = track.id;
  void post('/api/library/history', { trackId: track.id, secondsPlayed: Math.round(playedSeconds), completed }).catch(() => {});
}

let syncTimer: number | undefined;
function scheduleSync(get: () => PlayerState) {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    const s = get();
    try {
      localStorage.setItem('dhunsun.player', JSON.stringify({ queue: s.queue, order: s.order, pos: s.pos, time: audio.currentTime, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat, contextLabel: s.contextLabel }));
    } catch {}
    if (useAuth.getState().user) {
      void put('/api/library/player', { queue: s.queue.map((t) => t.id).slice(0, 500), index: Math.max(0, s.order[s.pos] ?? 0), position: audio.currentTime, shuffle: s.shuffle, repeat: s.repeat, volume: s.volume }).catch(() => {});
    }
  }, 1500);
}

export const usePlayer = create<PlayerState>((set, get) => {
  const load = (track: Track, autoplay = true) => {
    reportPlay(get().current, false);
    playedSeconds = 0;
    reportedFor = null;
    set({ current: track, loading: true, error: null, time: 0, duration: track.duration });
    audio.src = track.streamUrl;
    audio.load();
    if (autoplay) {
      audio.play().catch((e) => { if (e?.name !== 'AbortError') set({ playing: false, loading: false }); });
    } else set({ loading: false });
    updateMediaSession(track);
    scheduleSync(get);
  };

  const advance = (dir: 1 | -1, auto = false) => {
    const { order, pos, repeat, queue } = get();
    if (!queue.length) return;
    let np = pos + dir;
    if (np >= order.length) {
      if (repeat === 'all' || !auto) np = 0;
      else { set({ playing: false }); audio.pause(); return; }
    }
    if (np < 0) np = repeat === 'all' ? order.length - 1 : 0;
    set({ pos: np });
    load(queue[order[np]]);
  };

  audio.addEventListener('play', () => set({ playing: true }));
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('playing', () => set({ loading: false }));
  audio.addEventListener('waiting', () => set({ loading: true }));
  audio.addEventListener('canplay', () => set({ loading: false }));
  audio.addEventListener('durationchange', () => { if (Number.isFinite(audio.duration)) set({ duration: audio.duration }); });
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    if (!audio.paused && t > lastTick && t - lastTick < 2) playedSeconds += t - lastTick;
    lastTick = t;
    set({ time: t });
    if (Math.floor(t) % 10 === 0) scheduleSync(get);
  });
  audio.addEventListener('ended', () => {
    reportPlay(get().current, true);
    if (get().repeat === 'one') { audio.currentTime = 0; void audio.play(); return; }
    advance(1, true);
  });
  audio.addEventListener('error', () => {
    set({ loading: false, error: 'This track could not be played' });
    window.setTimeout(() => { if (get().error) advance(1, true); }, 1200);
  });

  const updateMediaSession = (track: Track) => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist.name,
      album: 'Dhunsun',
      artwork: track.artworkLarge ? [{ src: track.artworkLarge, sizes: '1000x1000', type: 'image/jpeg' }] : [],
    });
  };
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => void audio.play());
    ms.setActionHandler('pause', () => audio.pause());
    ms.setActionHandler('previoustrack', () => get().prev());
    ms.setActionHandler('nexttrack', () => get().next());
    ms.setActionHandler('seekto', (d) => { if (d.seekTime != null) get().seek(d.seekTime); });
  }

  const startQueue = (tracks: Track[], startIndex: number, label?: string, autoplay = true) => {
    if (!tracks.length) return;
    const shuffle = get().shuffle;
    const order = shuffle ? shuffled(tracks.length, startIndex) : tracks.map((_, i) => i);
    const pos = shuffle ? 0 : startIndex;
    set({ queue: tracks, order, pos, contextLabel: label ?? null });
    load(tracks[order[pos]], autoplay);
  };

  return {
    queue: [], order: [], pos: 0, current: null, playing: false, loading: false, time: 0, duration: 0,
    volume: 0.8, muted: false, shuffle: false, repeat: 'off', contextLabel: null, error: null,

    playTracks: (tracks, startIndex = 0, label) => startQueue(tracks, startIndex, label),

    playTrack: (track, contextTracks, label) => {
      const { current, queue } = get();
      if (current?.id === track.id) { get().toggle(); return; }
      if (contextTracks?.length) {
        const i = contextTracks.findIndex((t) => t.id === track.id);
        startQueue(contextTracks, Math.max(0, i), label);
        return;
      }
      const existing = queue.findIndex((t) => t.id === track.id);
      if (existing >= 0) { get().jumpTo(get().order.indexOf(existing)); return; }
      startQueue([track], 0, label);
    },

    playRadio: async (track) => {
      startQueue([track], 0, `${track.title} Radio`);
      try {
        const { tracks } = await apiGet<{ tracks: Track[] }>(`/api/catalog/tracks/${track.id}/radio`);
        const rest = tracks.filter((t) => t.id !== track.id);
        const queue = [track, ...rest];
        set({ queue, order: queue.map((_, i) => i), pos: 0, shuffle: false });
      } catch {}
    },

    toggle: () => {
      if (!get().current) { const q = get().queue; if (q.length) load(q[get().order[get().pos]]); return; }
      if (audio.paused) void audio.play(); else audio.pause();
    },
    next: () => advance(1),
    prev: () => { if (audio.currentTime > 3) { audio.currentTime = 0; return; } advance(-1); },
    seek: (sec) => { audio.currentTime = Math.max(0, Math.min(sec, audio.duration || get().duration)); set({ time: audio.currentTime }); },
    setVolume: (v) => { audio.volume = v; audio.muted = v === 0; set({ volume: v, muted: v === 0 }); scheduleSync(get); },
    toggleMute: () => { audio.muted = !audio.muted; set({ muted: audio.muted }); },

    toggleShuffle: () => {
      const { shuffle, queue, order, pos } = get();
      const curIdx = order[pos];
      if (!shuffle) {
        const no = shuffled(queue.length, curIdx);
        set({ shuffle: true, order: no, pos: 0 });
      } else {
        set({ shuffle: false, order: queue.map((_, i) => i), pos: curIdx ?? 0 });
      }
      scheduleSync(get);
    },
    cycleRepeat: () => { const r = get().repeat; set({ repeat: r === 'off' ? 'all' : r === 'all' ? 'one' : 'off' }); scheduleSync(get); },

    addToQueue: (tracks) => {
      const list = Array.isArray(tracks) ? tracks : [tracks];
      const { queue, order } = get();
      const base = queue.length;
      set({ queue: [...queue, ...list], order: [...order, ...list.map((_, i) => base + i)] });
      if (!get().current) load(get().queue[get().order[0]], false);
      scheduleSync(get);
    },
    playNext: (track) => {
      const { queue, order, pos } = get();
      const idx = queue.length;
      const no = [...order];
      no.splice(pos + 1, 0, idx);
      set({ queue: [...queue, track], order: no });
      if (!get().current) load(track, false);
      scheduleSync(get);
    },
    removeFromQueue: (queueIndex) => {
      const { queue, order, pos } = get();
      const op = order.indexOf(queueIndex);
      if (op === pos) return;
      const nq = queue.filter((_, i) => i !== queueIndex);
      const no = order.filter((i) => i !== queueIndex).map((i) => (i > queueIndex ? i - 1 : i));
      set({ queue: nq, order: no, pos: op < pos ? pos - 1 : pos });
      scheduleSync(get);
    },
    jumpTo: (orderPos) => { set({ pos: orderPos }); load(get().queue[get().order[orderPos]]); },
    clearQueue: () => {
      const { current } = get();
      if (!current) { set({ queue: [], order: [], pos: 0 }); return; }
      set({ queue: [current], order: [0], pos: 0 });
      scheduleSync(get);
    },
    upcoming: () => { const { queue, order, pos } = get(); return order.slice(pos + 1).map((qi, i) => ({ track: queue[qi], orderPos: pos + 1 + i })); },

    restore: async () => {
      try {
        const raw = localStorage.getItem('dhunsun.player');
        if (raw) {
          const s = JSON.parse(raw);
          if (Array.isArray(s.queue) && s.queue.length) {
            audio.volume = s.volume ?? 0.8;
            set({ queue: s.queue, order: s.order, pos: s.pos, volume: s.volume ?? 0.8, shuffle: !!s.shuffle, repeat: s.repeat ?? 'off', contextLabel: s.contextLabel ?? null });
            const t = s.queue[s.order[s.pos]];
            if (t) { load(t, false); audio.currentTime = s.time ?? 0; set({ time: s.time ?? 0 }); }
            return;
          }
        }
      } catch {}
      audio.volume = get().volume;
    },
  };
});

// Keyboard shortcuts: space (play/pause), arrows (seek), shift+arrows (track), m (mute)
window.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  const p = usePlayer.getState();
  if (e.code === 'Space') { e.preventDefault(); p.toggle(); }
  else if (e.key === 'ArrowRight') { e.shiftKey ? p.next() : p.seek(p.time + 10); }
  else if (e.key === 'ArrowLeft') { e.shiftKey ? p.prev() : p.seek(p.time - 10); }
  else if (e.key === 'm') p.toggleMute();
});
