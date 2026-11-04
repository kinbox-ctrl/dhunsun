import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './lib/env.ts';
import { errorHandler } from './middleware/index.ts';
import { authRouter } from './routes/auth.ts';
import { catalogRouter } from './routes/catalog.ts';
import { libraryRouter } from './routes/library.ts';
import { streamRouter } from './routes/stream.ts';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/stream', streamRouter);
app.use('/api/library', libraryRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'No such endpoint' } }));

// Serve the built client in production.
const dist = path.resolve(process.cwd(), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1y', index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const server = app.listen(env.port, () => console.log(`▶ Dhunsun API listening on http://localhost:${env.port}`));
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
