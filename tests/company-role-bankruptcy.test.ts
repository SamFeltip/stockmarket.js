import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { roundPrices } from "../shared/settlement";
import { previewRound, roundProgress } from "../src/round-preview";
import { revealGroups } from "../src/reveals";
import { websiteBoard } from "../src/spectator/presentation";
import { roundPrices as tvRoundPrices } from "../../stockmarket-tv/src/website/settlement";
import { setup } from "./game-setup";

const cases = [
    { opening: 1, positive: 0, expected: 0, situation: "still goes bankrupt" },
    { opening: 1, positive: 0.5, expected: 0.5, situation: "avoids bankruptcy" },
    { opening: 0, positive: 0, expected: 0, situation: "stays bankrupt" },
    { opening: 0, positive: 0.5, expected: 0, situation: "cannot recover with insufficient positive movement" },
    { opening: 0, positive: 2, expected: 1, situation: "recovers because of influence" },
    { opening: 0, positive: 5, expected: 4, situation: "recovers with the full cancelled card restored" },
].flatMap((scenario) => ["director", "chairman"].map((role) => ({ ...scenario, role })));

const testBankruptcy = it.each(cases);

testBankruptcy("$role influence when a stock $situation", async ({ opening, positive, expected, role }) =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });
    const owner = initial.players[0]._id;
    const other = initial.players[1]._id;
    const cancelled = await t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "closed", prices: initial.game.prices.map((price) =>
            price.stockKey === 8 ? { ...price, value: opening } : price) });

        for (const player of initial.players)
        {
            await context.db.patch(player._id, { holdings: [{ stockKey: 8,
                quantity: player._id === owner ? (role === "chairman" ? 100_000 : 50_000) : 0 }] });
        }

        for (const insight of await context.db.query("playerInsights").collect())
        {
            await context.db.delete(insight._id);
        }

        const insert = (playerId: typeof owner, value: number) => context.db.insert("playerInsights", {
            gameId: initial.game._id, period: 0, playerId, stockKey: 8, value,
            description: "Bankruptcy regression", resolved: false,
        });
        // A chairman can cancel another player's card; a director can cancel only their own.
        const id = await insert(role === "chairman" ? other : owner, -3);

        await insert(other, -1);
        await insert(other, positive);

        return id;
    });
    const board = await sam.query(api.board.get, { code: "test" });
    const snapshot = (await sam.query(api.tv.board, { code: "test" }))!;
    const bonuses = board.insights.filter((insight) => insight.bonusRole);

    expect(bonuses).toEqual([expect.objectContaining({ playerId: owner, bonusRole: role,
        removedInsightId: cancelled, value: 3 })]);
    expect(snapshot.reveal!.insights.filter((insight) => insight.bonusRole)).toEqual([
        expect.objectContaining({ playerId: owner, bonusRole: role, removedInsightId: cancelled, value: 3 }),
    ]);
    const preview = previewRound(board, board.insights, [8]);
    const stockStep = revealGroups(board.stocks, board.insights).findIndex((stock) => stock.key === 8);
    const count = board.insights.filter((insight) => insight.stockKey === 8).length;
    const completedReveal = roundProgress(board, stockStep, count);
    const price = (prices: { stockKey: number; value: number }[]) => prices.find((item) => item.stockKey === 8)!.value;

    expect(price(preview.game.prices)).toBe(expected);
    expect(price(completedReveal.preview.game.prices)).toBe(expected);
    expect(price(completedReveal.wealth.game.prices)).toBe(expected);
    const spectator = websiteBoard(snapshot);

    expect(price(previewRound(spectator, spectator.insights, [8]).game.prices)).toBe(expected);
    expect(price(tvRoundPrices(board.game.prices, board.insights, board.stocks, []))).toBe(expected);
    // Apply the floor after cancelling the card, rather than adding £3 to an already floored result.
    expect(price(roundPrices(board.game.prices, board.insights.filter((insight) => !insight.bonusRole),
        board.stocks, []))).toBe(Math.max(0, opening + positive - 4));
    expect(price(roundPrices(board.game.prices, board.insights, board.stocks, [8]))).toBe(opening);

    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    const settled = await sam.query(api.board.get, { code: "test" });

    expect(settled.game.prices).toEqual(preview.game.prices);
    expect(settled.players.map((player) => player.netWorth)).toEqual(preview.players.map((player) => player.netWorth));
    expect(settled.players.find((player) => player._id === owner)!.roles).toContainEqual({ stockKey: 8, role });
});
