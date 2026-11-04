# Shared engine checkout

This branch consumes the shared rules and NPC strategies in `../stockmarket-shared`.
Keep this repository inside the parent Stockmarket workspace; a checkout of only the web
repository is no longer sufficient. The original Go/HTMX project is now `../stockmarket-old`.

The parent workspace has its own Git repository tracking the shared engine and the separate
`../stockmarket-ai` headless environment. The existing game repository retains its history.
`shared-workspace.json` records the parent commit containing the required shared-code baseline;
later parent commits may update documentation without changing the engine.

- Game rules and NPC strategies belong in the shared package.
- Convex owns persistence, authentication, live subscriptions and presentation scheduling.
- Existing `shared/` and `packages/` modules forward imports to the single shared implementation.
- The existing NPC evaluation command now uses the complete shared game lifecycle through the
  headless adapter, rather than maintaining a simplified simulation of the rules.
- `npm run check` includes a full-game Convex-versus-memory parity test.

Run the independent shared and headless checks from the parent as described in `../README.md`.
No UI, training application or production deployment is included in the extraction.

Pre-existing local rule edits (including £500 rounding and NatWest at £8) were preserved as the
extraction baseline. Their existing documentation and test edits are recorded in a separate baseline commit.
