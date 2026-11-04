import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.ts';

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

export const db = new DatabaseSync(env.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

  -- Cached catalog snapshot of tracks the app has touched (favorites, history, playlists).
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    artwork TEXT,
    duration INTEGER NOT NULL,
    genre TEXT,
    mood TEXT,
    play_count INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    cover_track_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id),
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
  );
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position);

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    artist_avatar TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, artist_id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id),
    played_at INTEGER NOT NULL,
    seconds_played INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_history_user_time ON history(user_id, played_at DESC);

  CREATE TABLE IF NOT EXISTS player_state (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  `,
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
let version = row?.version ?? 0;
for (let i = version; i < MIGRATIONS.length; i++) {
  db.exec('BEGIN');
  try {
    db.exec(MIGRATIONS[i]);
    if (row) db.prepare('UPDATE schema_version SET version = ?').run(i + 1);
    else db.prepare('INSERT INTO schema_version(version) VALUES (?)').run(i + 1);
    db.exec('COMMIT');
    version = i + 1;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const now = () => Date.now();
