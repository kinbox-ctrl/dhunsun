# Dhunsun

A full-stack music streaming app — Spotify-grade UX on top of the open [Audius](https://audius.co) catalog (millions of free, legally streamable tracks, no API key required).

## Features

**Listening**
- Gapless single-`<audio>` player with queue, shuffle, repeat (off/all/one), volume, seek, keyboard shortcuts (`Space`, `←/→`, `Shift+←/→`, `M`, `⌘K`)
- Media Session integration — lock-screen / hardware-key / AirPods controls with artwork
- "Radio" from any song (artist + related artists + genre + tag blend, re-ranked by your taste)
- Queue panel ("play next", "add to queue", remove, reorder by jumping) and a Now Playing panel with credits, BPM, tags
- Player state persists locally and syncs to your account across devices

**Discovery**
- Home: *Made for you*, *Jump back in*, per-genre *Mixes*, *Artists you might like*, trending, underground, mood shelves
- Search with top-result detection, songs/artists/playlists tabs and genre filter; Browse-all genre grid
- Artist pages (popular / latest, bio, "fans also like", follow), public playlist/album pages ("save to library")

**Library**
- Accounts (JWT access tokens + rotating httpOnly refresh cookies, bcrypt, rate-limited auth)
- Liked Songs, followed artists, playlists (create/edit/delete, add/remove, drag-to-reorder, public share links, mosaic covers)
- Listening history and an Insights page (listening time, top songs/artists/genres, taste profile)

## Stack

| Layer | Tech |
|---|---|
| API | Node 22+, Express 5, TypeScript (`tsx`), `node:sqlite` (WAL), zod, helmet, express-rate-limit |
| Web | Vite, React 19, TypeScript, Tailwind v4, Zustand, TanStack Query, React Router, lucide |
| Catalog | Audius public API, normalized + cached in SQLite with stale-on-error fallback |

Audio bytes never pass through the server: `/api/stream/:id` resolves a signed CDN URL and 302s, so the browser does Range requests straight to the CDN.

## Run it

```bash
npm install
npm run dev          # API on :4000, web on :5173 (proxies /api)
```

Production:

```bash
npm run build        # builds client/dist, typechecks server
npm start            # serves API + built client from :4000
```

### Environment (`server/.env`)

```
JWT_ACCESS_SECRET=   # required in production
JWT_REFRESH_SECRET=  # required in production
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DB_PATH=./data/dhunsun.sqlite
AUDIUS_APP_NAME=dhunsun
```

## API overview

```
POST /api/auth/{register,login,refresh,logout,logout-all,password}   GET/PATCH /api/auth/me
GET  /api/catalog/{home,genres,trending,search}
GET  /api/catalog/tracks/:id           GET /api/catalog/tracks/:id/radio
GET  /api/catalog/artists/:id          GET /api/catalog/collections/:id
GET  /api/stream/:id
GET  /api/library/likes  PUT/DELETE /api/library/likes/:id
GET  /api/library/follows  PUT/DELETE /api/library/follows/:id
GET/POST /api/library/playlists  GET/PATCH/DELETE /api/library/playlists/:id
POST /api/library/playlists/:id/tracks  DELETE .../tracks/:trackId  PUT .../order
GET/POST/DELETE /api/library/history   GET /api/library/insights
GET/PUT /api/library/player
```
