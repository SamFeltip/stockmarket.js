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

Chance-card details use the existing trade modal/drawer shell. Activate is always
disabled: no chance-card effects, turn costs, retention, insurance claims, or
option expiry are implemented in this step. The cards are newly dealt each round.
New Share Suspended cards do not invoke the legacy hold mutation or block round
settlement. Duplicate physical cards appear as separate granted cards.

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
The preview is a Vite development entry point, not a production route.

Dependencies are shared with the original checkout via a local `node_modules`
symlink. Existing ignored PNG/font assets were copied from that checkout.

## Validation

`npm run check` runs lint, integration/UI tests, TypeScript, the production build,
and asset validation. `tests/chance-cards.test.tsx` covers deck composition,
shared dealing without replacement, per-round redealing, privacy, only granted
cards appearing, disabled activation, zero/positive/negative cash totals, shared
settlement and rounding, preview parity, and duplicate settlement rejection.
PNG screenshots in `../screenshots/` record desktop and mobile layouts.
