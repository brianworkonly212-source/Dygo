# Dygo

Interactive cultural exploration app for Hanoi, implemented from the Paper design source.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS with shadcn-style local UI primitives
- MapLibre GL JS for the map view
- Cytoscape.js for the cultural graph view and graph interactions
- Supabase schema/RLS migrations and demo seed SQL
- React Hook Form + Zod, TanStack Table for admin CRUD
- Gemini-compatible chat route with demo fallback when `GEMINI_API_KEY` is missing
- Playwright smoke tests

## Run

```bash
corepack pnpm install
corepack pnpm dev
```

Open `http://127.0.0.1:3000`.

## Verify

```bash
corepack pnpm lint
corepack pnpm build
corepack pnpm test:e2e
```

## Environment

Copy `.env.example` to `.env.local` and fill values when connecting live services. Without env vars, the app runs in demo-first mode using local seed data.
