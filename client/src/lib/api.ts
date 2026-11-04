/**
 * API client: attaches the access token, transparently refreshes it once on 401
 * (via the httpOnly refresh cookie), and surfaces server errors as ApiError.
 */
import type { User } from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSession: ((s: { user: User; accessToken: string } | null) => void) | null = null;

export const session = {
  set(token: string | null) { accessToken = token; },
  get() { return accessToken; },
  onChange(cb: typeof onSession) { onSession = cb; },
};

export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) { accessToken = null; onSession?.(null); return false; }
      const data = (await res.json()) as { user: User; accessToken: string };
      accessToken = data.accessToken;
      onSession?.(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Opts { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; retry?: boolean }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [k, val] of Object.entries(opts.query ?? {})) if (val !== undefined && val !== '') url.searchParams.set(k, String(val));
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), credentials: 'include' });

  if (res.status === 401 && opts.retry !== false && !path.startsWith('/api/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}

export const get = <T>(path: string, query?: Opts['query']) => api<T>(path, { query });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const put = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
