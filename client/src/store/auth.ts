import { create } from 'zustand';
import { api, post, refreshSession, session } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  likedIds: Set<string>;
  followedIds: Set<string>;
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: { email: string; username: string; displayName?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  toggleLike: (trackId: string) => Promise<boolean>;
  toggleFollow: (artistId: string) => Promise<boolean>;
}

async function loadSets(set: (p: Partial<AuthState>) => void) {
  const [likes, follows] = await Promise.all([
    api<{ ids: string[] }>('/api/library/likes/ids').catch(() => ({ ids: [] })),
    api<{ artists: { id: string }[] }>('/api/library/follows').catch(() => ({ artists: [] })),
  ]);
  set({ likedIds: new Set(likes.ids), followedIds: new Set(follows.artists.map((a) => a.id)) });
}

export const useAuth = create<AuthState>((set, get) => {
  session.onChange((s) => {
    if (s) { set({ user: s.user }); void loadSets(set); }
    else set({ user: null, likedIds: new Set(), followedIds: new Set() });
  });

  return {
    user: null,
    ready: false,
    likedIds: new Set(),
    followedIds: new Set(),

    bootstrap: async () => {
      await refreshSession();
      set({ ready: true });
    },

    login: async (identifier, password) => {
      const data = await post<{ user: User; accessToken: string }>('/api/auth/login', { identifier, password });
      session.set(data.accessToken);
      set({ user: data.user });
      await loadSets(set);
    },

    register: async (input) => {
      const data = await post<{ user: User; accessToken: string }>('/api/auth/register', input);
      session.set(data.accessToken);
      set({ user: data.user });
    },

    logout: async () => {
      await post('/api/auth/logout').catch(() => {});
      session.set(null);
      set({ user: null, likedIds: new Set(), followedIds: new Set() });
    },

    setUser: (user) => set({ user }),

    toggleLike: async (trackId) => {
      const liked = get().likedIds.has(trackId);
      const next = new Set(get().likedIds);
      if (liked) next.delete(trackId); else next.add(trackId);
      set({ likedIds: next });
      try {
        await api(`/api/library/likes/${trackId}`, { method: liked ? 'DELETE' : 'PUT' });
      } catch (e) {
        set({ likedIds: get().likedIds }); // leave optimistic; refresh on next load
        throw e;
      }
      return !liked;
    },

    toggleFollow: async (artistId) => {
      const following = get().followedIds.has(artistId);
      const next = new Set(get().followedIds);
      if (following) next.delete(artistId); else next.add(artistId);
      set({ followedIds: next });
      await api(`/api/library/follows/${artistId}`, { method: following ? 'DELETE' : 'PUT' });
      return !following;
    },
  };
});
