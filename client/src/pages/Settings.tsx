import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inputCls } from '../components/Modals';
import { Avatar, Btn } from '../components/ui';
import { ApiError, patch, post } from '../lib/api';
import type { User } from '../lib/types';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';

const COLORS = ['#1DB954', '#E13300', '#509BF5', '#F573A0', '#FFC862', '#8C67AB', '#1E3264', '#27856A', '#E8115B', '#BA5D07'];

export function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { toast } = useUI();
  const nav = useNavigate();
  const [name, setName] = useState(user?.displayName ?? '');
  const [color, setColor] = useState(user?.avatarColor ?? COLORS[0]);
  const [pw, setPw] = useState({ current: '', next: '' });
  if (!user) { nav('/auth'); return null; }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const { user: u } = await patch<{ user: User }>('/api/auth/me', { displayName: name, avatarColor: color }); setUser(u); toast('Profile saved'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await post('/api/auth/password', pw); toast('Password changed — please sign in again'); await logout(); nav('/auth'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Failed', 'error'); }
  };

  return (
    <div className="fade-up mx-auto max-w-xl space-y-10">
      <h1 className="text-3xl font-black">Settings</h1>
      <form onSubmit={saveProfile} className="space-y-4 rounded-lg bg-elevated p-6">
        <div className="flex items-center gap-4"><Avatar name={name || user.username} color={color} size={64} /><div><p className="font-bold">@{user.username}</p><p className="text-sm text-subtle">{user.email}</p></div></div>
        <label className="block text-sm"><span className="mb-1 block text-subtle">Display name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <div><p className="mb-2 text-sm text-subtle">Avatar color</p><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={clsx('h-8 w-8 rounded-full ring-offset-2 ring-offset-elevated transition', color === c && 'ring-2 ring-white')} style={{ background: c }} aria-label={c} />)}</div></div>
        <Btn type="submit">Save profile</Btn>
      </form>
      <form onSubmit={changePw} className="space-y-4 rounded-lg bg-elevated p-6">
        <h2 className="font-bold">Change password</h2>
        <input className={inputCls} type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
        <input className={inputCls} type="password" placeholder="New password (8+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required />
        <Btn type="submit" variant="outline">Update password</Btn>
      </form>
      <div className="rounded-lg bg-elevated p-6">
        <h2 className="mb-1 font-bold">Sessions</h2>
        <p className="mb-4 text-sm text-subtle">Sign out on every device where you're logged in.</p>
        <Btn variant="danger" onClick={async () => { await post('/api/auth/logout-all').catch(() => {}); await logout(); toast('Signed out everywhere'); nav('/'); }}>Log out everywhere</Btn>
      </div>
      <div className="text-xs text-faint">Keyboard: <kbd>Space</kbd> play/pause · <kbd>←/→</kbd> seek 10s · <kbd>Shift+←/→</kbd> prev/next · <kbd>M</kbd> mute · <kbd>⌘K</kbd> search</div>
    </div>
  );
}
