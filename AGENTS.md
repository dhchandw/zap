# AGENTS.md

## Cursor Cloud specific instructions

ZAP (ZCL Advanced Platform) is a single Node.js product: an Electron/Quasar (Vue 3) UI plus an Express + WebSocket + `node-ipc` backend and a Handlebars code-generation engine, backed by an embedded SQLite database (auto-created under `~/.zap`). There is no separate database/cache/queue and no login/auth. Standard commands live in `package.json` scripts and `docs/development-instructions.md`; the notes below are only the non-obvious, durable caveats for this environment.

### Node version caveat (important)

- The VM's default `node` is v22 (from `/exec-daemon/node`, ahead of nvm on `PATH`). Native modules (`sqlite3`, `canvas`, `bufferutil`, `utf-8-validate`) are compiled for this v22 during `npm install`/`npm ci` postinstall, so stay on the default node. Do not switch to nvm node 20 without also rebuilding native modules, or the app will fail to load them.
- CI and `docs/development-instructions.md` target node 20.x. Because of this, `env.versionsCheck()` (a hardcoded allowlist of v14/16/18/20 in `src-electron/util/env.js`) prints a warning and the single unit test `test/env.test.js › Environment Tests › Versions check` FAILS on node v22. This is cosmetic (version allowlist only); everything else builds, runs, lints, and tests pass. Ignore that one failure in this environment.

### Running the app / UI (non-obvious)

- The backend serves the built SPA at `http://localhost:9070`, but `dist/` and the SPA build are gitignored. You MUST build the SPA before the UI is served: run `npm run build-spa` (or `npm run build`, or `npm run self-check` which also builds) once per fresh checkout, then start the server with `npm run zap-devserver` (Zigbee). Without a prior SPA build, `http://localhost:9070` will not render the UI.
- For live frontend hot-reload, the alternative is `quasar dev` on port 8080 pointed at the backend: browse to `http://localhost:8080/?restPort=9070` (see `docs/faq.md`). This does not require pre-building the SPA.
- Other backend modes: `npm run matterzap-devserver` (Matter), `npm run zapall-devserver` (multiprotocol). The server is single-instance via a `node-ipc` socket (`--reuseZapInstance`); use `npm run status` / `npm run stop` to inspect or stop it. State lives in `~/.zap/...` state directories.

### Tests

- Unit tests (`npm run test:unit`) are Jest with heavy SQLite/generation integration and enforce coverage thresholds on the full run. To run a subset quickly without tripping coverage gates, use `npx jest <name-fragment> --collectCoverage=false`. Set `ZAP_LOGLEVEL=fatal` to silence noisy pino ZCL-metadata warnings during tests.
- E2E (`npm run test:e2e-ci`, Cypress) orchestrates its own dev server + `quasar dev` and requires a browser/display; the pino "XML validation issues …" warnings at server startup are normal ZCL metadata notes, not errors.
