# Player footer and board-game card dealing

Branch: `poc/player-cash-dock`.

The game board reserves a full-width footer for cash, the player's private cash
insight total, and granted chance cards. Only the chance-card strip scrolls
horizontally. Cash now appears in the footer; the desktop header shows net worth.

## Real game behavior

New games pin a complete deck at launch: the recovered 92 share-price cards,
eight cash cards (four +10%, four −10%), and ten chance cards (two of each type).
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
It advances the round normally when used on the last turn. Other chance-card
effects remain disabled. Cards are newly dealt each round; duplicate physical
cards can each be redeemed on separate turns. New Share Suspended cards do not
invoke the legacy hold mutation or block round settlement.

Rules: EP0297870A1, Schedule of Cards, PDF pages 4–5:
https://patents.google.com/patent/EP0297870A1/en#description
The text extraction of PDF page 4 explicitly lists eight gold cards, four of each
±10%. Its five chance-card entries specify two copies each.

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
