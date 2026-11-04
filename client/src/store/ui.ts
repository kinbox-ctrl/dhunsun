import { create } from 'zustand';
import type { Track } from '../lib/types';

interface Toast { id: number; message: string; kind: 'info' | 'error' }

interface UIState {
  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  addToPlaylistTrack: Track | null;
  openAddToPlaylist: (t: Track) => void;
  closeAddToPlaylist: () => void;
  createPlaylistOpen: boolean;
  setCreatePlaylistOpen: (v: boolean) => void;
  authPrompt: boolean;
  setAuthPrompt: (v: boolean) => void;
  rightPanel: 'queue' | 'now' | null;
  setRightPanel: (v: UIState['rightPanel']) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

let n = 0;
export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  toast: (message, kind = 'info') => {
    const id = ++n;
    set({ toasts: [...get().toasts, { id, message, kind }] });
    window.setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  addToPlaylistTrack: null,
  openAddToPlaylist: (t) => set({ addToPlaylistTrack: t }),
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null }),
  createPlaylistOpen: false,
  setCreatePlaylistOpen: (v) => set({ createPlaylistOpen: v }),
  authPrompt: false,
  setAuthPrompt: (v) => set({ authPrompt: v }),
  rightPanel: null,
  setRightPanel: (v) => set({ rightPanel: v }),
  sidebarCollapsed: false,
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
}));
