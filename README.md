# otherend

otherend is an engineering intelligence platform for turning raw software ideas into production-reviewable backend, database, security, and release packages.

it is positioned as the standards layer above coding models: architecture, backend quality, database design, security, testing, operations, and release readiness in one review system.

## run locally

```bash
npm install
npm run dev:full
```

the app runs on `http://127.0.0.1:5173` and proxies api calls to `http://127.0.0.1:8787`.

## build

```bash
npm run build
npm start
```

`npm start` serves the production build and api from the same node server.

## production database

set `DATABASE_URL` to a hosted postgres connection string. the app auto-creates the production schema on first request, and the full schema is also available in `database.sql`.

```bash
DATABASE_URL=postgres://user:password@host:5432/otherend
SESSION_SECRET=replace-with-a-long-random-secret
```

without `DATABASE_URL`, local development falls back to `.data/db.json`. vercel without `DATABASE_URL` uses temporary serverless storage only, so set postgres before treating the app as production.

## stripe payments

paid access is designed around stripe checkout. the app has a checkout endpoint at `/api/billing/checkout`.

set these environment variables in vercel:

```bash
APP_URL=https://otherend-app.vercel.app
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_PRICE_PRO=price_id_for_paid_monthly_plan
STRIPE_WEBHOOK_SECRET=whsec_for_subscription_webhook
```

current behavior:

- free tier reviews ideas, uploaded zip files, and public github repos, then explains risks and fixes
- free tier should be enforced as 3 reviews per month once subscription/account limits are connected
- paid tier shows the otai corrected approach, safer code plan, tests, stronger build prompt, and corrected package zip
- stripe checkout opens when `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PRO` are configured
- subscription enforcement still needs the stripe webhook to mark users as paid in the database

## github review

launch behavior:

- upload a `.zip` of code for review
- paste a public github repo url for review
- otai scans project structure and flags backend, database, security, testing, and launch signals

private github repo review is possible, but it should be added as a github app or oauth connection after launch. required env vars for that phase:

```bash
GITHUB_CLIENT_ID=github_oauth_client_id
GITHUB_CLIENT_SECRET=github_oauth_client_secret
GITHUB_APP_ID=github_app_id
GITHUB_PRIVATE_KEY=github_app_private_key
GITHUB_WEBHOOK_SECRET=github_webhook_secret
```

## product surface

- project intake for software ideas
- discipline-based review pipeline
- readiness scorecards
- risk and control mapping
- database implementation review
- generated engineering artifacts
- export-ready implementation brief
- zip code structure scan
- public github repo scan
- free and paid review modes
- stripe checkout setup endpoint
- corrected package zip for paid reviews

## backend included

- signed email session
- postgres-ready persistence through `DATABASE_URL`
- local `.data/db.json` fallback for development
- users, workspaces, memberships, projects, reviews, and audit logs
- project create/update/list endpoints
- persisted review history
- audit log endpoint
- deterministic engineering review pipeline
- markdown export endpoint
- static production server for `dist`
