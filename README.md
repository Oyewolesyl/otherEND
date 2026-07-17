# otherend

otherend is an ai engineering intelligence interface for turning raw ai-generated software ideas into production-reviewable engineering packages.

it is positioned as the standards layer above coding models: architecture, backend quality, security, testing, operations, and release readiness in one review console.

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

## product surface

- project intake for ai-built software ideas
- discipline-based review pipeline
- readiness scorecards
- risk and control mapping
- generated engineering artifacts
- export-ready implementation brief

## backend included

- signed email session
- persisted users and projects in `.data/db.json`
- project create/update/list endpoints
- deterministic engineering review pipeline
- markdown export endpoint
- static production server for `dist`
