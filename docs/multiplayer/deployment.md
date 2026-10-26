# Running live multiplayer

The Vite frontend stays on Vercel. Live lobbies require the separate persistent Node/WebSocket service in `server/`; Vercel's static deployment does not run this process. No public multiplayer endpoint has been deployed by these changes.

## Local play and verification

Use Node 24 and install dependencies with `npm ci`.

```sh
npm run start:multiplayer   # port 3001
npm run dev               # separate terminal; localhost uses ws://localhost:3001
```

Open two browser windows, choose cars, open Multiplayer, create a lobby and share its code. Guests request access; only the owner can approve them. Pending guests receive no vehicle snapshots. Free Drive has independent player pausing and noncolliding cars. Race needs two connected ready drivers; the owner starts a five-second grid countdown. Server physics determines laps, finishing order and results. Owner can cancel/rematch. Recovery is disabled during an active race; leaving or disconnecting does not pause the other drivers. Membership can resume within 30 seconds, with ownership transferred when necessary.

```sh
npm test
npm run test:multiplayer
npm run build
npm run preview -- --port 4176
# With the multiplayer service and preview running:
TEST_URL=http://127.0.0.1:4176 npm run test:multiplayer:browser
# UI-only test uses the Vite dev server:
TEST_URL=http://127.0.0.1:5173 node tests/multiplayer-ui.mjs
```

## Render blueprint

`render.yaml` and `Dockerfile.multiplayer` provide a deployable single-instance service.

1. In your Render account, create a Blueprint from this repository and select the branch containing this upgrade.
2. Set `ALLOWED_ORIGINS` to the exact Vercel site origin, for example `https://your-project.vercel.app`. Multiple origins use commas; no paths or trailing slash. Include preview origins explicitly if needed.
3. Deploy the service. Confirm `https://YOUR-SERVICE.onrender.com/health` returns `{"ok":true}`.
4. In Vercel project environment variables, set `VITE_MULTIPLAYER_URL=wss://YOUR-SERVICE.onrender.com` for the relevant environments and redeploy the frontend. This is a public build-time address, not a secret.
5. Test create/request/approve from two separate devices using the deployed Vercel page.

The blueprint selects a free plan to avoid implicitly purchasing a service. Free services may sleep or restart; an always-on plan is preferable for uninterrupted sessions. No account, paid plan or service has been created automatically.

## Other persistent hosts

Build the Dockerfile and expose its `PORT` (default 3001), or run `node server/index.js`. Set `ALLOWED_ORIGINS` and terminate TLS at the hosting platform so the browser can use `wss://`. Health endpoint: `/health`.

Run exactly one instance initially. Rooms and resume tokens live in memory; process restarts close sessions. Horizontal scaling needs room routing/sticky connections or a shared state/coordination layer. Capacity and latency on a particular hosting plan need load measurement; eight players is the per-room product limit, not a measured throughput guarantee.

## Scope

The server accepts controls rather than client-supplied positions/laps, bounds inputs and payload sizes, enforces owner actions and approval, rotates resume tokens, and rate-limits connections/messages. Driver names use plain text. There are no accounts, persistent online rankings, car-to-car collisions, voice chat or durable race history. Local personal bests remain separate per car and route and are not overwritten by online results.
