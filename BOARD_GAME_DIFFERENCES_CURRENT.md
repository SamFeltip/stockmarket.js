# Current stockmarket-convex versus the 1987 Stockmarket board game

Researched and compared on 16 October 2026. Retail-rule corrections from the BGG review added on 2 November 2026; implementation notes updated on 3 November 2026.

This tracked copy records current behavior. The local-only `local-notes/BOARD_GAME_DIFFERENCES.md` remains the original research snapshot. Rows marked **Aligned** are completed changes, rather than remaining differences.

## Card-dealing implementation on `poc/player-cash-dock` (3 November 2026)

As of 3 November 2026, new games deal the retail 108-card deck: the
92 recovered share-price cards, four +10% and four −10% cash/gold cards, and two
of each of the four retail chance cards (no Options), following the retail review below.
The four +10% and four −10% cash counts also match the patent’s Schedule of Cards (page 4).
Each player receives ten cards without replacement each round from the pinned
deck. Existing running games keep their original pinned catalogs.

Cash is shown as a private aggregate in the footer, including grey +0%. At period
end, the sum of everyone's dealt cash cards affects all remaining balances; the
adjustment is rounded to £1,000. Legacy imported `currency` cards keep their
previous per-player treatment. Government Loan and Debenture are implemented;
Share Suspended is implemented after stock and cash reveals, before the summary.
Rights Issue and legacy Option activation remain disabled. Debentures
are retained and refund purchase cost within two periods. These are patent-based
behaviors: the retail review instead describes a 108-card deck, £500 cash rounding,
opening-price Debenture sales and no retained cards.
See `shared/chance-cards.ts`, `shared/settlement.ts`, `convex/launch.ts`, and
`tests/chance-cards.test.tsx`. The card rows below distinguish this branch from the earlier baseline;
other implementation notes retain their original research scope.

## Scope and sources

The likely reference is **Stockmarket! (Jordans Games, 1987)**, identified by [BoardGameGeek's English-edition listing](https://boardgamegeek.com/boardgameversion/28804/english-edition). This is an identification based on the title and matching mechanics; the user's physical edition has not been inspected.

The main rules source is the **“Description” section of [EP0297870A1, Board games](https://patents.google.com/patent/EP0297870A1/en#description)**, which explicitly reproduces rules for a game named Stockmarket. It is a contemporary primary source, with a 1987 priority date and 1989 publication date. The [US patent in the same family](https://patents.google.com/patent/US4934707A/en#description) reproduces them too. These are patent-published rules, rather than a verified scan of the retail rules leaflet; edition-specific differences remain possible.

The application side below comes from the local **stockmarket-convex** source, including its shipped catalog. It is not an audit of the currently deployed database. Links to application files are relative to this document.

## Retail rules described in the BGG review (2 November 2026)

[Neil Palfreyman’s review of Stockmarket! (13 April 2006)](https://boardgamegeek.com/thread/106869/review-of-stockmarket) describes the retail game differently from the patent. Use these reviewed retail rules for the card comparisons below; retain the patent as a separate rules variant, not proof that the retail cards work the same way. The physical rules leaflet has still not been inspected.

| Area | Retail rules in the review | Earlier patent-based documentation |
| --- | --- | --- |
| Deck | 108 cards: 92 share movements, eight currency cards (four each ±10%), eight chance cards (two each of four types). | 110 cards, including two Options. |
| Government Loan Stock | One bargain to collect £10,000. | Same payout and turn cost. |
| Rights Issue | One bargain selects a company; every holder may immediately buy one extra share per two held, at £1 per extra share. | Grants 50% extra shares without a purchase payment. |
| Debenture | One bargain sells shares in a bankrupt company at that company’s opening price. | Retained insurance refunding purchase cost within two periods. |
| Share Suspended | Choose a company at period end, just before price adjustment; keep its previous price. | Same price-freezing effect. |
| Option | Absent from the four retail chance-card types. | Reserves a trade price for up to three periods. |
| Card lifecycle | Return all cards, including unused chance cards; reshuffle and deal ten each period. Nothing carries over. | Allows retained Debentures and Options. |
| Currency rounding | Apply the shared currency percentage to spare cash, rounding to £500. | Round adjustments to £1,000. |

The review does not specify Rights Issue rounding, insufficient-cash handling or supply limits, nor a Debenture claim deadline beyond the card’s current-period lifetime. Do not import the patent’s details into those gaps. Its later replies include a separate digital adaptation with house rules; those are not retail rules.

Other evidence: the review confirms the six company names and gives Legal & General’s opening price as £4 and NatWest’s as £8 (the app starts NatWest at £9). It describes an agreed game length; the reviewer recommends at least four periods, rather than establishing the patent’s 6–10 as a retail requirement. The full retail starting-price chart and card frequencies remain unverified.

## Differences in ordinary games

Card, currency and lifecycle entries below use the retail review above. Other entries retain the earlier [patent rules comparison](https://patents.google.com/patent/EP0297870A1/en#description); **Aligned** labels on those entries refer to the patent, not independent verification of the retail leaflet.

| Area                  | Board-game rule                                                                                                | stockmarket-convex behavior and consequence                                                                                                                                                                                                                                                                          | Application evidence                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting funds | £60,000 in gold. | **Aligned:** hosts and guests now start with £60,000 cash. Existing players retain their stored balances. | [games.ts](convex/games.ts), `create` and `join` |
| Game length | 6–10 bargain periods. | **Aligned:** creation and lobby controls offer every length from 6 through 10 periods. The server validates these choices. Existing short lobbies must select a supported length before launch; games already playing retain their stored length. Internally, `periodCount` remains the final zero-based period index (5–9). | [CreateGame.tsx](src/CreateGame.tsx), [games.ts](convex/games.ts), [rounds.ts](convex/rounds.ts) |
| Share supply | 200,000 shares per company. | **Aligned:** the server, stock panel and trading form use a shared limit of 200,000 shares per company across all players. | [trading.ts](convex/trading.ts), [StockPanel.tsx](src/StockPanel.tsx), [TradeModal.tsx](src/TradeModal.tsx) |
| Permitted trade sizes | 1,000–5,000 in 1,000 steps; above that, 10,000 multiples.                                                      | **Aligned:** purchases and sales accept 1,000–5,000 in steps of 1,000, then multiples of 10,000 only. Cash entry, maximum quantities and +/- buttons select permitted sizes. Both browser and server reject 6,000 or 15,000. | [rules.ts](shared/rules.ts), [trading.ts](convex/trading.ts), [TradeModal.tsx](src/TradeModal.tsx), [trades.ts](src/trades.ts) |
| Last-trader advantage | Last trader rotates clockwise between periods.                                                                 | **Aligned:** the opening seat advances by one each period, rotating the final-trader advantage too. The seat order within each period stays fixed. | [library.ts](convex/library.ts), `members`; [trading.ts](convex/trading.ts); [rounds.ts](convex/rounds.ts), `next`                          |
| Chairman              | At ≥100,000 shares, discard one revealed company card; earliest qualifier wins ties.                           | **Aligned (automatic):** qualification order is retained across periods and reset when holdings fall below 100,000. The chairman automatically cancels the worst revealed negative company card. In legacy games without qualification records, tied existing holdings use seat order.                                                                                                                                                                           | [schema.ts](convex/schema.ts), [trading.ts](convex/trading.ts), [rounds.ts](convex/rounds.ts)                                               |
| Director              | At 50,000–100,000 shares, discard one own company card; chairman takes precedence. One discard/company/period. | **Aligned (automatic):** directors automatically cancel the worst negative card from their own hands, with chairman precedence and a single cancellation per company per period. Multiple directors compete for the one cancellation using the worst eligible card. Both roles have investor badges; round reveals and the final overview show the cancelled value as a role bonus.                                                                                                                                                                                  | [StockPanel.tsx](src/StockPanel.tsx), [rounds.ts](convex/rounds.ts)                                                                         |
| Deck                  | Retail review: 108 cards (92 share, eight currency, eight chance); no Options.                                                                    | New games: **108 cards**, with two Share Suspended cards; ten are dealt per player without replacement each period. Existing games retain their pinned catalogs. | [catalog.ts](convex/catalog.ts), [library.ts](convex/library.ts), `deal`; [README.md](README.md), “Original assets and missing source data” |
| Gold movements        | Aggregate currency cards affect everyone; retail review rounds to £500 (patent: £1,000).                                             | Current branch: all dealt cash cards jointly affect remaining balances, with the adjustment rounded to £1,000. **Differs from the review’s £500 rounding.** Imported legacy currency cards retain per-player handling. | [catalog.ts](convex/catalog.ts), [rounds.ts](convex/rounds.ts)                                                                              |
| Share Suspended       | Freeze one company's price at period end.                                                                      | Implemented: choose after stock and cash reveals, in the period’s rotated play order, before summary and settlement. Use or confirmed skip spends one physical card; spectator displays can override with a confirmed skip. The old Hold Stock Price path is separate. | [rounds.ts](convex/rounds.ts), `hold`; [catalog.ts](convex/catalog.ts)                                                                      |
| Government Loan Stock | Spend a turn to collect £10,000.                                                                               | Implemented on this branch: consumes one card and one turn to pay £10,000.                                                                                                                                                                                                                                   | [trading.ts](convex/trading.ts), [catalog.ts](convex/catalog.ts)                                                                            |
| Debenture | Retail review: spend a bargain to sell bankrupt-company shares at the company’s opening price; no retention. | Implemented patent variant: retain unused physical cards across deals; refund purchase cost within two rounds, using FIFO after partial sales. **Differs from retail:** payout basis, claim window and retention; requires a future code change. | [debenture.ts](convex/game/debenture.ts), [commands.ts](convex/game/commands.ts), [DebentureModal.tsx](src/DebentureModal.tsx) |
| Rights Issue          | Spend a bargain; all holders may buy one extra share per two held in the chosen company at £1 per extra share.                                           | Current branch: two cards are dealt, but activation is disabled. The footer and dialog now describe the retail purchase of one extra share per two held, at £1 per extra share, using one turn. The purchase flow is not implemented. | [trading.ts](convex/trading.ts), [rounds.ts](convex/rounds.ts)                                                                              |
| Option                | Absent from the retail review; the three-period Option belongs to the patent variant.                             | Excluded from new retail decks. Existing pinned games may still have Options, displayed as unavailable; activation is disabled. | [schema.ts](convex/schema.ts), [trading.ts](convex/trading.ts)                                                                              |

## Legacy imported-card mechanics

The following notes describe the earlier catalog’s legacy `currency` and hold-stock paths. The branch’s new cash/chance cards are described above; these legacy paths do not establish their behavior.

### Currency settlement differs even if cards are restored

`rounds.next` selects `currency` insights **belonging to each individual player**, sums that player's values, and applies:

```text
new cash = max(0, truncate(old cash × (1 + own currency-card sum)))
```

Consequently, importing gold/currency cards alone would not implement the shared gold adjustment described in the comparison table. For example, if Alice alone held a +10% currency insight and Alice and Bob each had £65,000 left, the current code would give Alice £71,500 and leave Bob at £65,000. It also truncates to whole pounds rather than using the retail review’s £500 rounding (or the patent’s £1,000 adjustment rounding). See [rounds.ts](convex/rounds.ts), `next`.

### Hold-stock support needs catalog data

`rounds.hold` lets the card owner select one tradable company, or resolve the insight without selecting one. Selected companies are added to `game.suspended`, and settlement suppresses their price movement. The host cannot settle while a dealt hold-stock insight remains unresolved.

The [existing integration test](tests/game.test.ts) injects currency and hold-stock fixtures to exercise this code. Fixtures do not make these cards part of the shipped deck. The [README](README.md) records that the recovered original database also lacked these special records.

## Digital presentation and administration

The application replaces physical bookkeeping with accounts, lobby codes, server validation, persistent games and live updates. The host launches play and must trigger settlement/continuation, including the final settlement. Round-end reveals are animated independently in each browser. Holdings, cash and net worth are available through the shared board data, and trades appear in an activity feed. See [games.ts](convex/games.ts), [board.ts](convex/board.ts), [RoundEnd.tsx](src/RoundEnd.tsx) and [library.ts](convex/library.ts).

The [edition listing](https://boardgamegeek.com/boardgameversion/28804/english-edition) and [game listing](https://boardgamegeek.com/boardgame/2963/stockmarket/ratings?rated=1) identify a 2–6-player game. **Aligned:** the application caps lobbies at six and now requires at least two players before launch. The lobby explains this requirement and disables launch until another player joins; the server enforces it too.

Stock details now show investor faces with share counts and missing-photo fallbacks, plus a responsive Recharts line chart of each company’s recorded prices. New games retain a starting snapshot and one snapshot per settled round, including the final round. Older games start recording from their current known price; unavailable historical prices are not reconstructed. The chart exposes only settled prices. On narrow screens the sections stack and tabs scroll horizontally; short screens scroll the stock panel vertically.

## Limits of this comparison

- The shipped companies are Trusthouse Forte, UB, Legal & General, Thames, Saatchi & Saatchi and Natwest, with starting prices £2, £2.50, £4, £5.50, £7.50 and £9 respectively. The review confirms those company identities but gives NatWest’s opening price as £8, so the app’s £9 differs. The full retail starting-price chart and exact share-card frequencies remain unverified. See [catalog.ts](convex/catalog.ts).
- The retail review explicitly requires all cards to be returned and reshuffled each period. Retaining a chance card would conflict with that account.
- The original implementation aligned six simpler items with the patent: starting cash, share supply, game length, minimum players, period turn rotation and trade sizes. The later card changes are described above; the retail-rule corrections in this update change documentation only.
- Validation: `npm run check` passes: lint, all 27 tests, TypeScript, production build and 27 asset references.
- Browser layout checks: sample game data at desktop, phone and short landscape dimensions, including 320 × 568; investor photos load, selected-stock history changes correctly, and the page has no horizontal overflow.
- Evidence: `tests/board-rules.test.ts` covers starting funds, shared supply, player minimum, length validation, permitted purchases/sales, rejected transactions and full six/ten-period games with rotating seats. `tests/errors.test.ts` checks cash entry and quantity-button boundaries.

### Automatic company roles (2 November 2026)

Role bonuses are price corrections, not cash payments. Every original company card is revealed, then one positive correction cancels the selected negative card at the end of that company's reveal. Each company card in the overview has a footer listing its chairman and directors, with player portraits and role badges. Only the player whose power cancelled a card receives a bonus amount and description, including when animations were skipped. The same roles and bonuses appear in web spectator and standalone TV views. Settlement uses the same selection as player and spectator previews, before the zero-price floor is applied. Positive and zero cards are never discarded. A held price remains held. Role qualification comes from current holdings, applies immediately to human and NPC trades, and survives period changes.

Trade events retain the actor's company role before and after the trade. The trade pop-up announces new roles and resignations. Feed entries show only the badge and small grey role label below the player's name, based on that historical event rather than current holdings. Feed avatar wrappers reserve space around the top-left badge so the scrolling feed does not clip it. This covers player, web spectator and standalone TV displays. Trades in unrelated companies and passes do not inherit a role badge.
