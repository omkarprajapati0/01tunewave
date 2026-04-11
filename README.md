# TuneWave

TuneWave is a React + Vite music app with routing, playlist management, Spotify integration, and Supabase authentication/storage.

## Production Readiness

Deployment checks completed:

- `npm install` passes
- `npm run lint` passes
- `npm run build` passes and generates `dist/`
- SPA rewrites configured for both Vercel and Netlify

## Required Environment Variables

Copy `.env.example` to `.env` for local development. For hosted environments, add these in your provider's environment variable settings.

Core:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Recommended for production search behavior:

- `VITE_YOUTUBE_API_KEY`
- `VITE_ENABLE_YOUTUBE_DATA_API=true`
- `VITE_ENABLE_EXTERNAL_PROXY_FALLBACK=false`

Spotify integration:

- `VITE_SPOTIFY_CLIENT_ID`
- `VITE_SPOTIFY_CLIENT_SECRET`

These are read by the Spotify token endpoint on the server side. Do not rely on them in the browser bundle.

## Local Development

```bash
npm install
npm run dev
```

## Build For Production

```bash
npm run build
npm run preview
```

## Deploy

### Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Routing fallback is already configured in `vercel.json`
- Add `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_CLIENT_SECRET` in the Vercel environment settings for the server-side token endpoint.

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Routing fallback is already configured in `netlify.toml`

Spotify auth is currently implemented with a server-side token endpoint in Vercel and Vite dev middleware. Netlify deployment will need the same serverless token pattern if you want Spotify to work there.

## Supabase Setup

Follow `SUPABASE_SETUP.md` to create tables, policies, bucket rules, and OAuth settings before enabling auth-dependent features in production.
