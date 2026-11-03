import { skipDealtSuspensions } from "./game-setup";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CashReveal } from "../src/CashReveal";
import { cashStockKey } from "../shared/chance-cards";
import { api } from "../convex/_generated/api";
import { revealGroups } from "../src/reveals";
import { roundProgress } from "../src/round-preview";
import { setup } from "./game-setup";

it("reveals individual cash cards, a running total, and the completed or empty cash summary", async () =>
{
    const { sam } = await setup();
    const board = await sam.query(api.board.get, { code: "test" });
    const cards = [
        { ...board.insights[0], stockKey: cashStockKey, value: -0.1, description: "Cash falls" },
        { ...board.insights[1], stockKey: cashStockKey, value: 0.1, description: "Cash rises" },
    ];
    const falling = renderToStaticMarkup(<CashReveal insights={cards} index={0} />);
    const rising = renderToStaticMarkup(<CashReveal insights={cards} index={1} />);
    const complete = renderToStaticMarkup(<CashReveal insights={cards} index={2} />);
    const empty = renderToStaticMarkup(<CashReveal insights={[]} index={0} />);

    expect(falling).toContain("−10%");
    expect(falling).toContain("text-danger");
    expect(falling).toContain("Cash falls");
    expect(rising).toContain("+0%");
    expect(rising).toContain("+10%");
    expect(rising).toContain("text-success");
    expect(complete).toContain("All cash insights revealed");
    expect(complete).toContain("text-secondary");
    expect(empty).toContain("No cash insights this round");
    expect(empty).toContain("+0%");
    const cancelling = [-0.1, -0.1, -0.1, 0.1, 0.1, 0.1].map((value) => ({ ...cards[0], value }));
    const cancelled = renderToStaticMarkup(<CashReveal insights={cancelling} index={6} />);

    expect(cancelled).toContain("text-secondary");
    expect(cancelled).toContain("+0%");
    expect(cancelled).not.toContain("−0%");
});

it("applies all players' cash cards only at the cash stage and carries the settled total into the overview", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "closed" });

        for (const card of await context.db.query("playerInsights").collect())
        {
            await context.db.patch(card._id, { value: 0 });
        }

        await context.db.insert("playerInsights", { gameId: initial.game._id, period: 0,
            playerId: initial.players[1]._id, stockKey: cashStockKey, value: -0.1, description: "Cash falls", resolved: true });
    });
    const board = await sam.query(api.board.get, { code: "test" });
    const groups = revealGroups(board.stocks, board.insights);
    const cashStep = groups.length - 1;
    const count = board.insights.filter((card) => card.stockKey === cashStockKey).length;
    const beforeCash = roundProgress(board, cashStep - 1, board.insights.length);
    const revealed = roundProgress(board, cashStep, count);
    const overview = roundProgress(board, groups.length, 0);

    expect(beforeCash.wealth.players.map((player) => player.cash)).toEqual(board.players.map((player) => player.cash));
    expect(revealed.wealth.players[0].cash).toBeLessThan(board.players[0].cash);
    expect(overview.preview.players).toEqual(revealed.wealth.players);
    await skipDealtSuspensions(sam, "test");
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    const settled = await sam.query(api.board.get, { code: "test" });

    expect(overview.preview.players.map((player) => [player.cash, player.netWorth, player.ranking]))
        .toEqual(settled.players.map((player) => [player.cash, player.netWorth, player.ranking]));
});
