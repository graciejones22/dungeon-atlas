# DungeonAtlas

DungeonAtlas is a real-time, collaborative Dungeons & Dragons game board. Build characters, create password-protected parties, and run encounters together on a shared tactical map.

**Live app:** [dungeon-atlas.app.space](https://dungeon-atlas.app.space)

## What it can do

- Create and manage private D&D characters.
- Create or join password-protected parties with a shareable party code.
- Give party members Dungeon Master or Player roles.
- Collaborate on a real-time board powered by DeepSpace Canvas rooms.
- Place character tokens, regular tokens, enemies, walls, and difficult terrain.
- Move and resize board objects; rotate terrain; customize token letters and colors.
- Let players move only their own character token, while DMs manage the encounter.
- Show linked party characters at the table and allow DMs to inspect character sheets.
- Let players inspect and update their own current HP; let DMs update any linked character's current HP.
- Keep enemy names, HP, and notes visible only to DMs.
- Measure board distances in grid squares and feet (5 feet per square).

## Roles and privacy

DungeonAtlas uses server-side checks for party permissions.

- **Dungeon Masters** can manage party membership, the shared board, enemy details, and character HP.
- **Players** can view the shared board, inspect their own linked character, update their own current HP, and move only their own placed character token.
- Characters, party membership, and DM-only enemy information are scoped to the appropriate user or party; hiding a control in the UI is never the only permission check.

## Tech stack

- React + TypeScript + Vite
- Cloudflare Workers and Durable Objects
- [DeepSpace SDK](https://docs.deep.space/) for authentication, real-time records, Canvas rooms, and server actions
- Tailwind CSS and Lucide icons

## Run locally

### Prerequisites

- Node.js 22.15–22.x, 24.x, or 26.x
- npm 11.6 or newer

### Setup
```bash
git clone https://github.com/graciejones22/dungeon-atlas.git
cd dungeon-atlas
npm install
npm run dev
```

The dev server prints its local URL when it starts. Sign in with separate accounts or browser profiles to test party roles and live collaboration.

## Project structure

```text
src/
  actions/       Server-side party, character, token, and enemy operations
  components/    Reusable UI and collaborative board components
  pages/         Landing, home, character, and party-board routes
  schemas/       DeepSpace collection schemas and permissions
  server/        Authenticated HTTP and real-time WebSocket routing
worker.ts         Cloudflare Worker and Durable Object assembly
```
