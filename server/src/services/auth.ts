import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { db, now, transaction } from '../lib/db.ts';
import { env } from '../lib/env.ts';
import { conflict, unauthorized } from '../lib/errors.ts';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
  avatar_color: string;
  created_at: number;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  username: r.username,
  displayName: r.display_name,
  avatarColor: r.avatar_color,
  createdAt: r.created_at,
});

const AVATAR_COLORS = ['#1DB954', '#E13300', '#509BF5', '#F573A0', '#FFC862', '#8C67AB', '#1E3264', '#27856A', '#E8115B', '#BA5D07'];
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const q = {
  byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  insert: db.prepare('INSERT INTO users(id,email,username,display_name,password_hash,avatar_color,created_at) VALUES (?,?,?,?,?,?,?)'),
  insertRefresh: db.prepare('INSERT INTO refresh_tokens(id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)'),
  findRefresh: db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL'),
  revokeRefresh: db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?'),
  revokeAll: db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'),
  purge: db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked_at < ?'),
  updateProfile: db.prepare('UPDATE users SET display_name = ?, avatar_color = ? WHERE id = ?'),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
};

export function getUser(id: string): User | null {
  const r = q.byId.get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}

export function signAccess(user: User) {
  return jwt.sign({ sub: user.id, un: user.username }, env.jwtAccessSecret, { expiresIn: env.accessTtlSeconds });
}

export function verifyAccess(token: string): { sub: string } {
  try {
    return jwt.verify(token, env.jwtAccessSecret) as { sub: string };
  } catch {
    throw unauthorized('Session expired');
  }
}

function issueRefresh(userId: string): string {
  const raw = randomBytes(48).toString('base64url');
  const expires = now() + env.refreshTtlDays * 86_400_000;
  q.insertRefresh.run(randomUUID(), userId, sha256(raw), expires, now());
  return raw;
}

export function issueSession(user: User) {
  return { user, accessToken: signAccess(user), refreshToken: issueRefresh(user.id), expiresIn: env.accessTtlSeconds };
}

export async function register(input: { email: string; username: string; displayName?: string; password: string }) {
  if (q.byEmail.get(input.email)) throw conflict('An account with that email already exists');
  if (q.byUsername.get(input.username)) throw conflict('That username is taken');
  const hash = await bcrypt.hash(input.password, 12);
  const id = randomUUID();
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  q.insert.run(id, input.email, input.username, input.displayName?.trim() || input.username, hash, color, now());
  return issueSession(getUser(id)!);
}

export async function login(input: { identifier: string; password: string }) {
  const r = ((input.identifier.includes('@') ? q.byEmail.get(input.identifier) : q.byUsername.get(input.identifier)) ?? null) as UserRow | null;
  const ok = r ? await bcrypt.compare(input.password, r.password_hash) : await bcrypt.compare(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
  if (!r || !ok) throw unauthorized('Incorrect email/username or password');
  return issueSession(toUser(r));
}

export function rotateRefresh(raw: string) {
  return transaction(() => {
    const row = q.findRefresh.get(sha256(raw)) as { id: string; user_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at < now()) throw unauthorized('Session expired');
    q.revokeRefresh.run(now(), row.id);
    const user = getUser(row.user_id);
    if (!user) throw unauthorized();
    return issueSession(user);
  });
}

export function logout(raw: string | undefined) {
  if (!raw) return;
  const row = q.findRefresh.get(sha256(raw)) as { id: string } | undefined;
  if (row) q.revokeRefresh.run(now(), row.id);
}

export function logoutEverywhere(userId: string) {
  q.revokeAll.run(now(), userId);
}

export function updateProfile(userId: string, patch: { displayName?: string; avatarColor?: string }) {
  const u = getUser(userId)!;
  q.updateProfile.run(patch.displayName?.trim() || u.displayName, patch.avatarColor ?? u.avatarColor, userId);
  return getUser(userId)!;
}

export async function changePassword(userId: string, current: string, next: string) {
  const r = q.byId.get(userId) as unknown as UserRow;
  if (!(await bcrypt.compare(current, r.password_hash))) throw unauthorized('Current password is incorrect');
  q.updatePassword.run(await bcrypt.hash(next, 12), userId);
  logoutEverywhere(userId);
}

// Housekeeping: purge dead refresh tokens hourly.
setInterval(() => q.purge.run(now(), now() - 7 * 86_400_000), 3_600_000).unref();
