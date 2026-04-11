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

Optional:

- `VITE_SPOTIFY_CLIENT_ID`
- `VITE_SPOTIFY_CLIENT_SECRET`

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

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Routing fallback is already configured in `netlify.toml`

## Supabase Setup

Follow `SUPABASE_SETUP.md` to create tables, policies, bucket rules, and OAuth settings before enabling auth-dependent features in production.
