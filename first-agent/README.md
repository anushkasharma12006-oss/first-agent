# First-Agent — deployment-ready personal finance assistant

## What was fixed
- Removed hard-coded localhost API URLs; frontend uses same-origin API routes.
- Removed secrets from the project; use `.env.example` and deployment environment variables.
- Replaced the fragile startup MySQL connection with a reusable connection pool.
- Added validation for registration, login, user IDs, and monetary amounts.
- Added `/health` endpoint for deployment health checks.
- Added complete MySQL schema in `schema.sql`.
- Fixed AI tool calls so the assistant executes the requested database action and then returns a natural-language response.
- Added safe static-file routing and path-traversal protection.
- Added Vercel configuration plus a normal Node server for Render/Railway/local hosting.
- Kept the existing frontend UI and project pages.

## Required environment variables
Copy `.env.example` to `.env` for local development, then fill in your real values. Never commit `.env`.

## Database
Run `schema.sql` once on your MySQL database.

## Local run
```bash
npm install
npm run check
npm start
```
Open `http://localhost:3000`.

## Vercel
Import this repository/project into Vercel and add the environment variables from `.env.example` in Project Settings → Environment Variables. Deploy. The included `vercel.json` routes `/api/*` to the Node serverless function and serves the frontend.

## Render / Railway / other Node hosts
Use:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: all values from `.env.example`

The service listens on the host-provided `PORT`.

## Important security note
The original ZIP contained live-looking credentials in `.env`. Those values are intentionally not included in this cleaned ZIP. If they were ever pushed to a public Git repository, rotate the Groq API key and MySQL password immediately.
