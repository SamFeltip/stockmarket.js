# Stockmarket — React + Convex

A cloud-hosted migration of the original Go/templ/HTMX game. React 19, TypeScript and Vite render the same Bootstrap layout; Convex provides username/password authentication, transactional game logic, persistent data and live subscriptions. The original Go project is untouched.

## Live deployment

- Frontend: https://stockmarket-convex.pages.dev (Cloudflare Pages)
- Backend: https://effervescent-flamingo-244.convex.cloud (Convex production)
- Dashboard: https://dashboard.convex.dev/t/sf-samfelton/stockmarket-convex

These are separate development and production databases. Create a new account on the production app; the migration does not copy existing PostgreSQL users, passwords or games.

## Run locally

Requires Node.js 22.18+.

```sh
npm ci
npm run dev
```

This starts the Convex backend watcher and Vite frontend together in one terminal. Press Ctrl+C to stop both. The project is already linked through ignored `.env.local`. On a fresh checkout, select the `stockmarket-convex` project when Convex asks. To run either service separately, use `npm run backend` or `npm run dev:frontend`.

Open http://127.0.0.1:5173. On a brand-new Convex project, configure password signing keys once with `node scripts/init-auth.mjs`. Do not run this against an already-configured project unless you intend to rotate its signing keys. Secrets are piped directly into Convex and never written to files or printed.

## Quality checks

```sh
npm run check
```

This runs ESLint, gameplay integration and lobby-error tests, strict TypeScript checking, a production build and asset validation. ESLint is adapted from the supplied config: recommended and type-aware TypeScript rules, Unicorn, Allman braces, four-space indentation, double quotes, semicolons, statement spacing, one statement per line, 120-character lines and 250-line files. Astro-only rules were replaced with React hooks and accessibility checks. JSX property indentation is explicitly four spaces to agree with the existing indent rule. ESLint also checks authored CSS with `@eslint/css`.

Vendored Bootstrap and the original CSS are immutable copies, excluded from lint formatting; generated Convex bindings and the generated SQL catalog are excluded too. Application code and scripts are linted. `npm run lint:fix` applies supported automatic fixes without disabling checks.

## Deploy updates

Run the complete deployment from this directory:

```sh
npm run deploy
```

This runs all quality checks, deploys Convex and rebuilds the frontend against its production URL, then uploads `dist` to Cloudflare Pages. Each step must succeed before the next runs. Convex and Cloudflare authentication must be configured; their CLIs may prompt you to sign in or confirm deployment.

The individual steps are available as `npm run deploy:backend` (including the production frontend build) and `npm run deploy:frontend` (upload only). Always run the backend step before the frontend step: a plain `npm run build` uses the development URL in `.env.local` and must not be uploaded to production. The production signing keys have already been configured. For a new production deployment only, use `node scripts/init-auth.mjs --prod` once.

Cloudflare's newer `cf` CLI does not currently offer Pages direct upload; Wrangler is used specifically for that operation. No Worker, nginx, Docker, PostgreSQL instance or custom WebSocket service is needed.

For future Git-connected Cloudflare Pages builds, set the root to this directory, the output to `dist`, and the build command to `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`. Add a production `CONVEX_DEPLOY_KEY` as a secret in Cloudflare; never commit it. This directory can also be used as its own repository root.

## Game features

- Username/password sign-up, five original profile pictures, sign-in and sign-out.
- Original routes: `/`, `/login`, `/signup`, `/logout`, `/games`, `/games/new`, `/games/show/:code`, `/users`, `/users/show/:id`, `/insights`.
- Case-insensitive lobby codes, two to six players, host-controlled six-to-ten-period game length and launch, live lobby updates.
- £60,000 starting cash; all six original stocks, prices, volatility and SQL insight templates; ten private insights per player per period.
- Rotating turns with three actions per player per period and a new opening seat each period; buying/selling 1,000–5,000 shares in steps of 1,000, then multiples of 10,000; 200,000 shares per company; passing; investor lists and portfolio rankings.
- Private insights, stock/player tabs, special insight display, activity feed, mobile offcanvas/menu and trade notifications.
- Animated round-end insight reveals, aggregate price changes floored at zero, special currency and hold-stock handling, next rounds and final rankings.
- Insight-description editor; editing now requires sign-in. User lists expose display names only.
- Responsive stock details with investor photos, share counts and a Recharts price-history line chart; recorded starting and settled prices, accessible chart data, and layouts that adapt to panel width and viewport height.

New games record their complete price history. Existing games begin history at their current known prices when their next round settles; earlier prices are not fabricated.

Convex mutations validate identity, membership, ownership, turn, quantities, cash and supply on the server. Trades and settlements are atomic. Stale turn/period guards reject duplicate clicks. The legacy implementation stored game length but never finished a game; this implementation settles the final selected period and shows final rankings. Existing active games keep their stored length and balances; existing lobbies with a shorter length must choose 6–10 periods before launch. Leaving a lobby removes the seat and transfers hosting if necessary. Leaving during play retains the seat for reconnection, as the old disconnect path did not remove players.

The six simpler board-game rule changes are implemented and tested. See [the current board-game comparison](BOARD_GAME_DIFFERENCES_CURRENT.md) for completed changes and remaining differences, including special cards and shareholder powers.

## Original assets and missing source data

Original images were recovered from the iCloud copy at `Documents/Code/Decent Projects/stockmarket/backend/static`. The four original stylesheets and Bootstrap assets are preserved byte-for-byte. Assets retain their `/static/` URLs. Two broken source references were repaired: the favicon uses the existing `stocks/logo.svg`, and Legal & General's secondary logo uses the supplied `.png` (the SQL incorrectly referenced a nonexistent `.svg`).

The original `BigCaslonRom.otf` file was missing from both source copies. Big Caslon was recovered from the Mac's installed fonts and bundled as `public/static/fonts/BigCaslon.ttf`. The authored stylesheet overrides the missing font source, so the title renders in Big Caslon on every device while the original stylesheets remain unchanged.

The original PostgreSQL database was inspected through Portainer on 16 October 2026. It contains six ordinary stocks and 92 insights, and no hidden/special stock records. A canonical checksum over every insight ID, stock ID, description and value matched this migration exactly (`c5048da3c6a51ab02da732905f5743c4`). The database container was temporarily started for read-only queries and stopped again afterward. Both copies of `database/setup.sql` contain only the six ordinary stocks and their insights. There are no currency or hold-stock seed records, although the Go code supports them. Those mechanics are implemented and tested with fixtures, but the production deck deliberately uses the exact supplied SQL instead of inventing special-card probabilities, values or descriptions. To restore special cards from your original database, load their original records through the internal `catalogAdmin:importCatalog` function before creating new games. Input shape:

```json
{
  "stocks": [{"key": 13, "name": "currency", "startingValue": 0, "imagePath": "/static/imgs/stocks/currency.png", "secondaryImagePath": "", "variation": 0, "display": false}],
  "insights": [{"key": 203, "stockKey": 13, "description": "Your original description", "value": 0.1}]
}
```

The JSON above illustrates the schema, not an original card to add. Load your own exported records using the Convex dashboard or `npx convex run catalogAdmin:importCatalog --prod '<your JSON>'`. Internal functions cannot be called from the browser. Catalog descriptions changed in the editor apply to future deals; dealt insights are immutable snapshots.

## Hosting costs

Cloudflare Pages serves static files on its free plan; Convex's free plan covers the backend within its published resource quotas. No paid plan or billing upgrade was enabled. These services have usage limits, so free hosting is not a promise of unlimited capacity.

Official references: https://developers.cloudflare.com/pages/platform/limits/ and https://www.convex.dev/pricing.

## Original database backup

The requested full schema-and-data SQL export and a separate schema-only reference are in `reference/`; see `reference/README.md` for checksums and restore instructions. The full data file is excluded from Git and from the public site.
