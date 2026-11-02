# Player cash dock proof of concept

Branch: `poc/player-cash-dock`.

The playing board now reserves a full-width bottom row for the current player's
cash, all five example chance cards, and one compact cash insight beneath the balance.
Stock and portfolio details scroll within the shorter middle panel. The dock
and trade buttons stay visible. The desktop feed ends above the dock.

Cash comes from `board.player.cash`. Power-ups and cash insights are static dummy
data. The cash insight is a single sample +20% value in the same white card and green movement style as private stock insights. Power-up dialogs explain that they are previews. Opening a power-up explains its
proposed ability; nothing is activated, persisted, or applied to a trade. No
backend/schema changes or random assignment logic are included.

## Run the standalone preview

From this worktree:

```sh
npm run dev:frontend -- --host 127.0.0.1 --port 5181
```

Open http://127.0.0.1:5181/experiments/cash-dock.html for all five cards, or append `?cards=none` to preview an empty hand. The preview uses a dummy
board fixture, requires no login or configured backend, and is a Vite development
entry point (not a production application route). Use the power-up buttons and
profile toggle to inspect the UI. Existing buy/sell/pass controls belong to the
real Playing component; the fixture is not connected to a working game backend.

Dependencies are shared with the original checkout via a local `node_modules`
symlink. The original repository ignores many existing PNG/font assets; those
local assets were copied into this worktree for an accurate preview. They are
unchanged and not part of this feature commit.

## Verification

- `npm run build` and `npm run lint` pass.
- Existing test suite: 28 files, 154 tests pass.
- Browser checks: 1440×900 desktop, 390×844 mobile, 320×568 small mobile,
  and 844×390 landscape.
- Both power-up previews open and dismiss. Portfolio scrolling leaves the dock
  stationary. Final browser check reports no warnings/errors or missing images.
- Screenshots are saved as PNG files in `../screenshots/`.

## Dummy chance-card references

All five examples follow the “Chance cards” schedule in the rules reproduced at
https://patents.google.com/patent/EP0297870A1/en#description, also summarized in
`BOARD_GAME_DIFFERENCES_CURRENT.md`:

- **Rights Issue:** 50% extra shares for all holders of the chosen company.
- **Share Suspended:** freeze one company's price at period end; cannot be retained.
- **Government Loan Stock:** collect £10,000 using one turn.
- **Debenture:** retain bankruptcy insurance; claim within two rounds of bankruptcy.
- **Option:** reserve a price and exercise within three periods, using a turn each time.

The general rules define exercising a chance card as a bargain (turn), but the
individual Rights Issue entry does not explicitly state the turn cost. The demo
explains this distinction in its preview dialog. Only the chance-card strip
scrolls horizontally; cash and its private insight remain fixed beside it.
