# Northflank deployment

Northflank can run the supplied persistent multiplayer service while Vercel serves the game. Supabase can be added later for accounts or saved race history; it is not required for these in-memory lobbies and is not used as a physics/WebSocket server.

No Northflank account or service is connected to this environment. The following is the concrete deployment configuration; do not paste API keys into chat.

Create a **combined build and deployment service** from `devperson8000/car-game`, branch `main`:

| Setting | Value |
|---|---|
| Build type | Dockerfile |
| Dockerfile path | `/Dockerfile.multiplayer` |
| Build context | Repository root `/` |
| Instances | 1 |
| Internal port | `3001` |
| Port protocol | HTTP, with a public HTTPS endpoint and WebSocket support |
| Health check | HTTP GET `/health`, port `3001` |
| Runtime `PORT` | `3001` |
| Runtime `ALLOWED_ORIGINS` | Exact Vercel site origin(s), comma-separated, e.g. `https://your-project.vercel.app` |

Use a runtime that stays running rather than a scheduled job. Keep the Dockerfile's default command. The public TLS endpoint serves both HTTPS health checks and WebSocket upgrades; there is no separate WebSocket port or custom path.

Once Northflank assigns the public hostname:

1. Open `https://YOUR-NORTHFLANK-HOST/health`; expect `{"ok":true}`.
2. In the Vercel project's environment variables, set `VITE_MULTIPLAYER_URL=wss://YOUR-NORTHFLANK-HOST`.
3. Redeploy the Vercel environment that should use multiplayer. This variable is read at build time.
4. From two devices, create a lobby, request to join, approve the guest, and enter Free Drive. Then test Race readiness/countdown.

Supply the public service URL (not credentials) to finish endpoint wiring. Hosting charges and plan choice stay under the account owner's control. Service restarts end in-memory sessions; keep one instance until shared room routing/persistence is implemented. See [deployment.md](deployment.md) for local verification and current behavior.

## Configured service

Public service supplied by the user: `https://p01--apex-multiplayer--yf5q7tyyggsr.code.run` (user confirmed a healthy HTTP response). `.env.production` sets its public WebSocket address for production builds. Existing Vercel environment variables take precedence; remove or update any older `VITE_MULTIPLAYER_URL`. Development still uses localhost unless explicitly configured. The public `/health` endpoint is reachable from this workspace. Browser gameplay is verified against a local copy of the service; test the deployed update from the Vercel origin after both services rebuild. Use `main` for both production services, or ensure the existing service branch includes the same release commit.
