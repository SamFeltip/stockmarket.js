# Player footer and board-game card dealing

Branch: `poc/player-cash-dock`.

The game board reserves a full-width footer for cash, the player's private cash
insight total, and granted chance cards. Only the chance-card strip scrolls
horizontally. Cash now appears in the footer; the desktop header shows net worth.

## Real game behavior

New games pin the retail 108-card deck at launch: the recovered 92 share-price cards,
eight cash cards (four +10%, four −10%), and eight chance cards (two of each retail type).
Options are excluded from new decks; existing games retain their pinned catalogs.
Ten cards are dealt per player, without replacement, from a fresh shuffle of that
same pinned deck each round. Cash/chance cards occupy hand slots rather than
being independent bonus rolls. Existing running games retain their pinned deck.

The footer totals only the current player's cash cards. No cards or cancelling
cards produce a grey +0%. Opponents' cards remain private while trading is open.
At settlement, all dealt cash cards are summed and affect every player's unspent
cash. The adjustment is rounded to the nearest £1,000, with half-thousands away
from zero. Settlement and the browser round preview use the same function.
Explicitly imported legacy `currency` cards preserve their old per-player logic.

Chance-card details use the existing trade modal/drawer shell. Government Loan
shows £10k above its name and can be activated during your turn to receive
£10,000. Activation consumes that dealt card and one turn, records a public bonus
event, and triggers the usual action popup with the money SVG. Redemption checks
membership, card ownership, period, turn, kind, and prior use in one transaction.
It advances the round normally when used on the last turn. Debenture is also
implemented; other chance-card effects remain disabled. Ten fresh cards are
dealt each round in addition to retained, unused debentures. Retained physical
cards are excluded from the shuffled deck until used, so they cannot be dealt
to another player. Duplicate physical cards can be redeemed on separate turns. Share Suspended
uses its own period-end phase and blocks settlement until every dealt copy is
spent or skipped; it does not invoke the legacy hold mutation.

Implementation source: EP0297870A1, Schedule of Cards, PDF pages 4–5:
https://patents.google.com/patent/EP0297870A1/en#description
The text extraction of PDF page 4 explicitly lists eight gold cards, four of each
±10%. Its five chance-card entries specify two copies each.

## Retail-rule correction (2 November 2026)

The [BGG review](https://boardgamegeek.com/thread/106869/review-of-stockmarket)
describes different retail rules: 108 cards, with two of each of four chance-card
types and no Option. Government Loan, Rights Issue and Debenture each consume a
bargain; Share Suspended is played at period end before price changes. Rights
Issue lets all holders buy one extra share per two held for £1 per extra share.
Debenture sells bankrupt-company shares at the company’s opening price. All
cards return to the deck each period, including unused chance cards; none carry
over. Currency rounding is to £500.

The deck and Share Suspended now follow the retail account. Retained purchase-cost
Debentures and £1,000 rounding still differ. Rights Issue content follows the retail
rules, but activation remains disabled. Option content says it is absent from the
retail board game; Options can still appear in older pinned decks. In particular,
the purchase-cost/FIFO ledger and two-round claim window below describe existing
software, not the review’s Debenture rule. See the [rules comparison](../BOARD_GAME_DIFFERENCES_CURRENT.md#retail-rules-described-in-the-bgg-review-2-november-2026)
for source distinctions and unresolved details. No code was changed for this
rules-documentation correction.

## Standalone visual preview

```sh
npm run dev:frontend -- --host 127.0.0.1 --port 5181
```

Open http://127.0.0.1:5181/experiments/cash-dock.html for all five example cards.
Append `?cards=none` for an empty hand; append `?cash=0` or `?cash=-10` to inspect
zero/negative cash totals (combine with `&cards=none` if needed). The preview uses
an offline fixture; the normal Playing component reads persisted dealt cards.
Government Loan activation in the demo updates local cash, removes the card,
advances the turn, and displays the bonus popup. Reload to reset the fixture.
The preview is separate from the production game. Build it for standalone hosting
with `npm run build:demo`; `dist-demo/` serves the demo at `/` and at
`/experiments/cash-dock.html`. Publish only that directory to the Pages preview
branch `cash-dock-demo`, never `main`. No Convex deployment is needed.

Dependencies are shared with the original checkout via a local `node_modules`
symlink. Existing ignored PNG/font assets were copied from that checkout.

## Debenture

Unused debentures remain private in the owner's footer across periods. They can
be redeemed on the owner's turn for all remaining shares in one currently
bankrupt company, during the first two trading rounds after bankruptcy. One
claim consumes one card and one turn. The selection dialog lists all bankrupt
holdings; expired claims or holdings with unknown purchase cost stay visible
but disabled. The dialog explains retention and the two-round claim deadline.

Refunds use the actual purchase cost of the shares still held, never the zero
market price, latest positive quote, or a fabricated starting price. New ordinary
trades record their unit price. Earlier trade records can use their recorded
period's price history. For partial sales from mixed-price purchases, the app
uses oldest purchases first (FIFO); the printed rules do not prescribe a lot
allocation convention. Imported holdings with insufficient purchase history
cannot be refunded automatically. Bankrupt companies that recover are excluded;
a subsequent bankruptcy starts a new two-round window. Claims clear only the
selected holding and update company roles, action history, public feed and popup.

Open `/?debenture=1` on the demo to try a retained card with two bankrupt
holdings. Selecting 20,000 UB stocks at £2.50 produces a £50,000 claim. Cancel
keeps the card and cash; Sell removes the chosen holding, consumes the card,
adds the payout and advances the turn. Reload to reset the offline demo.

## Cash reveal preview

Append `?view=round` to walk through stock reveals, then cash, then the round
summary. Cash cards reveal every 2.5 seconds with a running percentage total;
"Skip to cash summary" reveals the total immediately. `&cash=-10` shows a fall;
`&cash=0` shows an empty cash reveal. Cash effects appear in player balances and
net worth when the cash reveal completes, using the same settlement rounding as
the game. Player and spectator displays share the cash reveal and sequence.

## Validation

`npm run check` runs lint, integration/UI tests, TypeScript, the production build,
and asset validation. `tests/chance-cards.test.tsx` covers deck composition,
shared dealing without replacement, per-round redealing, privacy, only granted
cards appearing, unsupported powers remaining disabled, zero/positive/negative cash totals, shared
settlement and rounding, preview parity, and duplicate settlement rejection.
PNG screenshots in `../screenshots/` record desktop and mobile layouts.

`tests/government-loan.test.tsx` verifies single-use redemption, ownership and
turn checks, final-turn closure, shared/public notifications, and NPC observation
compatibility. Production backend changes require the normal coordinated
backend/frontend deployment; the standalone staging demo needs only `build:demo`.


## Share Suspended (3 November 2026)

After company and cash reveals, the shared suspension phase processes dealt cards
one at a time, in the current period’s rotated play order. A holder can select
any tradable company, including one they do not own, and keep its pre-adjustment
price. Already suspended companies cannot be selected again. All quantities in
the selection grid belong to the current card holder; both opening and proposed
per-share prices are shown. Holdings are ordered by company volatility.

The card is marked both used and resolved after selection or a confirmed skip.
Canceling the skip confirmation spends nothing. Spectator web and TV displays
show the actor, public portfolios and prices, with a confirmed skip override.
NPCs automatically protect the largest held loss, otherwise skip. Settlement is
blocked until all decisions finish, including on the final period; cash changes
are unaffected by a stock suspension. Legacy imported Hold Stock Price cards
keep their separate compatibility flow.

New games use the retail 108-card multiset, including exactly two suspension cards,
and shuffle/deal ten per player without replacement every period. Existing games
keep their pinned catalogs. Other retained Debenture rules are unchanged.

Offline previews (reload to reset):
- `?suspend=1`: active phone player; choosing a stock advances to the next holder.
- `?suspend=waiting`: phone waiting view.
- `?suspend=spectator`: spectator portfolios, valuations and confirmed skips.
- `?suspend=reveal`: full stock → cash → suspension → summary sequence.

These demo callbacks update local state. Backend mutations are verified separately
through real Convex handlers in `tests/share-suspended.test.tsx`. The companion TV
client is on `poc/share-suspended` in `stockmarket-tv-share-suspended`; its
`?demo=1&view=suspend` preview also works offline. No production backend is deployed
by the Pages demo command.
