import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chanceStockKey, loanAmount, type ChanceKind } from "../shared/chance-cards";
import { rightsPriceFor } from "../shared/rights-issue";
import { pendingSuspensions } from "../shared/suspensions";
import { roundCash } from "../shared/settlement";
import { setup, skipDealtSuspensions } from "./game-setup";

const code = "test";

async function startTech()
{
    const result = await setup();

    await result.sam.mutation(api.games.setPack, { code, pack: "tech" });
    await result.sam.mutation(api.games.start, { code });

    const board = await result.sam.query(api.board.get, { code });
    const addCard = (chanceKind: ChanceKind, period = 0) => result.t.run((context) =>
        context.db.insert("playerInsights", {
            gameId: board.game._id, playerId: board.player._id, stockKey: chanceStockKey,
            description: chanceKind, period, value: 0, resolved: false, chanceKind,
        }));

    return { ...result, board, addCard };
}

it("redeems a Tech loan on the player's turn", async () =>
{
    const { sam, board, addCard } = await startTech();
    const insightId = await addCard("loan");

    await sam.mutation(api.trading.activateGovernmentLoan, { code, insightId, expectedPeriod: 0, expectedTurn: 0 });
    const after = await sam.query(api.board.get, { code });

    expect(after.player.cash - board.player.cash).toBe(loanAmount("tech"));
    expect(after.game.turn).toBe(1);
});

it("charges the discounted quote for a Tech rights purchase", async () =>
{
    const { t, sam, board, addCard } = await startTech();
    const { stockKey, value } = board.game.prices[0];
    const insightId = await addCard("rights");

    await t.run((context) => context.db.patch(board.player._id, {
        holdings: board.player.holdings.map((holding) => holding.stockKey === stockKey
            ? { stockKey, quantity: 2000 } : holding),
    }));
    await sam.mutation(api.rightsIssue.activate, { code, insightId, stockKey, expectedPeriod: 0, expectedTurn: 0 });
    await sam.mutation(api.rightsIssue.decide, { code, insightId, expectedIndex: 0, quantity: 1000 });
    const after = await sam.query(api.board.get, { code });

    expect(after.player.cash).toBeCloseTo(board.player.cash - 1000 * rightsPriceFor("tech", value));
    expect(after.player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity).toBe(3000);
});

it("reveals and settles cash cards while suspending a Tech quote through the normal round flow", async () =>
{
    const { t, sam, board, addCard } = await startTech();
    const opening = board.game.prices[0];

    await addCard("hold");
    await t.run((context) => context.db.patch(board.game._id, { status: "closed" }));
    const snapshot = await t.query(api.tv.board, { code });
    const reveal = snapshot!.reveal!;
    const [ownHold] = pendingSuspensions(0, board.players, reveal.insights);

    expect(ownHold.playerId).toBe(board.player._id);

    await sam.mutation(api.rounds.beginSuspensions, { code, expectedPeriod: 0 });
    await sam.mutation(api.rounds.suspendShare, { code, expectedPeriod: 0, insightId: ownHold._id,
        stockKey: opening.stockKey });
    await skipDealtSuspensions(sam, code);
    await sam.mutation(api.rounds.next, { code, expectedPeriod: 0 });
    const next = await sam.query(api.board.get, { code });

    expect(next.game.prices[0]).toEqual(opening);
    expect(next.player.cash).toBe(roundCash(board.player, reveal.insights, reveal.stocks));
    expect(next.insights.filter((card) => card.forecast)).toHaveLength(12);
    expect(next.insights.some((card) => card.period === 1 && card.chanceKind)).toBe(true);
});

it("redeems a Tech debenture at the price before a qualifying drop", async () =>
{
    const { t, sam, board, addCard } = await startTech();
    const stockKey = board.game.prices[0].stockKey;
    const insightId = await addCard("debenture", 1);

    await t.run(async (context) =>
    {
        const opening = board.game.prices.map((price) =>
            price.stockKey === stockKey ? { stockKey, value: 100 } : price);
        const prices = opening.map((price) => price.stockKey === stockKey ? { stockKey, value: 89 } : price);

        await context.db.patch(board.game._id, {
            currentPeriod: 1, prices, priceHistory: [{ period: 0, prices: opening }, { period: 1, prices }],
        });
        await context.db.patch(board.player._id, {
            holdings: board.player.holdings.map((holding) => holding.stockKey === stockKey
                ? { stockKey, quantity: 2000 } : holding),
        });
    });
    await sam.mutation(api.trading.redeemDebenture, { code, insightId, stockKey, expectedPeriod: 1, expectedTurn: 0 });
    const after = await sam.query(api.board.get, { code });

    expect(after.player.cash - board.player.cash).toBe(200_000);
    expect(after.player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity).toBe(0);
});
