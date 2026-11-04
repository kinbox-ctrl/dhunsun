import clsx from 'clsx';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { inputCls } from '../components/Modals';
import { Btn } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';

export function AuthPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'register' ? 'register' : 'login';
  const nav = useNavigate();
  const { login, register } = useAuth();
  const { toast } = useUI();
  const [f, setF] = useState({ identifier: '', email: '', username: '', displayName: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === 'login') await login(f.identifier.trim(), f.password);
      else await register({ email: f.email.trim(), username: f.username.trim(), displayName: f.displayName.trim() || undefined, password: f.password });
      toast(mode === 'login' ? 'Welcome back' : 'Welcome to Dhunsun');
      nav('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-highlight to-base p-4">
      <div className="fade-up w-full max-w-md rounded-2xl bg-surface p-8 shadow-2xl">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-black"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-black"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M7 5v14l12-7z" /></svg></span>Dhunsun</Link>
        <div className="mb-6 flex rounded-full bg-elevated p-1">
          {(['login', 'register'] as const).map((m) => <button key={m} onClick={() => { setParams({ mode: m }); setErr(null); }} className={clsx('flex-1 rounded-full py-2 text-sm font-bold transition', mode === m ? 'bg-white text-black' : 'text-subtle hover:text-white')}>{m === 'login' ? 'Log in' : 'Sign up'}</button>)}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'login' ? (
            <input autoFocus className={inputCls} placeholder="Email or username" value={f.identifier} onChange={set('identifier')} autoComplete="username" required />
          ) : (
            <>
              <input autoFocus className={inputCls} type="email" placeholder="Email" value={f.email} onChange={set('email')} autoComplete="email" required />
              <input className={inputCls} placeholder="Username" value={f.username} onChange={set('username')} autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" title="Letters, numbers, dots and underscores" />
              <input className={inputCls} placeholder="Display name (optional)" value={f.displayName} onChange={set('displayName')} maxLength={40} />
            </>
          )}
          <input className={inputCls} type="password" placeholder="Password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : 1} />
          {err && <p className="rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">{err}</p>}
          <Btn type="submit" disabled={busy} className="mt-2 w-full">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Btn>
        </form>
        <p className="mt-6 text-center text-xs text-faint">Free forever. Music streamed from the open Audius network.</p>
      </div>
    </div>
  );
}
