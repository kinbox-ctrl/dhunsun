import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../lib/env.ts';
import { requireAuth, v, validate, wrap } from '../middleware/index.ts';
import * as auth from '../services/auth.ts';

export const authRouter = Router();

const REFRESH_COOKIE = 'dhunsun_rt';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  path: '/api/auth',
  maxAge: env.refreshTtlDays * 86_400_000,
};

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } } });

const registerSchema = z.object({
  email: z.string().email().max(254),
  username: z.string().min(3).max(24).regex(/^[a-z0-9_.]+$/i, 'Only letters, numbers, dots and underscores'),
  displayName: z.string().max(40).optional(),
  password: z.string().min(8, 'At least 8 characters').max(128),
});
const loginSchema = z.object({ identifier: z.string().min(1).max(254), password: z.string().min(1).max(128) });

function send(res: any, session: ReturnType<typeof auth.issueSession>) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOpts);
  res.json({ user: session.user, accessToken: session.accessToken, expiresIn: session.expiresIn });
}

authRouter.post('/register', authLimiter, validate(registerSchema), wrap(async (req, res) => send(res, await auth.register(v(req)))));
authRouter.post('/login', authLimiter, validate(loginSchema), wrap(async (req, res) => send(res, await auth.login(v(req)))));

authRouter.post('/refresh', wrap(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return res.status(401).json({ error: { code: 'unauthorized', message: 'No session' } });
  try {
    send(res, auth.rotateRefresh(raw));
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
    throw e;
  }
}));

authRouter.post('/logout', wrap(async (req, res) => {
  auth.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
  res.status(204).end();
}));

authRouter.post('/logout-all', requireAuth, wrap(async (req, res) => {
  auth.logoutEverywhere(req.user!.id);
  res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
  res.status(204).end();
}));

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

authRouter.patch('/me', requireAuth, validate(z.object({ displayName: z.string().min(1).max(40).optional(), avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional() })), (req, res) => {
  res.json({ user: auth.updateProfile(req.user!.id, v(req)) });
});

authRouter.post('/password', requireAuth, validate(z.object({ current: z.string().min(1), next: z.string().min(8).max(128) })), wrap(async (req, res) => {
  const { current, next } = v<{ current: string; next: string }>(req);
  await auth.changePassword(req.user!.id, current, next);
  res.clearCookie(REFRESH_COOKIE, { path: cookieOpts.path });
  res.status(204).end();
}));
