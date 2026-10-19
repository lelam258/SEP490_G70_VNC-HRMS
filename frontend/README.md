# Frontend (React microfrontends)

`apps/shell` is the host; `apps/login`, `apps/system-admin`, and `apps/organization` are independently runnable Vite remotes composed with Module Federation. Each app has its own package, dev server, and build.

Requires Node.js 20+ and npm. From this folder run `npm install` then `npm run dev`. Shell: http://localhost:5173; remotes: ports 5174–5176. Frontend placeholders are in place; authentication/token flow and feature APIs are the next implementation step. Protected API requests will use `Authorization: Bearer <access-token>`. Copy `.env.example` to `.env.local` for local service URLs. Never commit real secrets.
