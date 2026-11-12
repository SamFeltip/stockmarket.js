import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chanceStockKey } from "../shared/chance-cards";
import { bankruptGame } from "./debenture-setup";
import { suspensionFixture } from "./suspension-setup";
import { setup, skipDealtSuspensions } from "./game-setup";
import { fixture } from "./rights-issue-setup";

const code = "test";

it("caps Frantic purchases at ten times the opening holding with no allowance for a zero-share opener", async () =>
{
    const { t, bob, clients, board, command, insightId } = await fixture();

    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { pack: "frantic" });
        await context.db.patch(board.player._id, { holdings: [] });
        await context.db.patch(board.players[3]._id, { cash: 25_000 });
    });
    await bob.mutation(api.rightsIssue.activate, command);
    const issue = (await bob.query(api.board.get, { code: "test" })).game.rightsIssue!;

    expect(issue.offers.map(({ playerId, maximum }) => [playerId, maximum]))
        .toEqual([[board.players[3]._id, 20_000], [board.players[0]._id, 40_000]]);
    const choice = { code: "test", insightId, expectedIndex: 0 };

    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 1000 })).rejects.toThrow("Wait for your");
    await expect(clients[3].mutation(api.rightsIssue.decide, { ...choice, quantity: 21_000 }))
        .rejects.toThrow("up to 10 extra shares");
    await clients[3].mutation(api.rightsIssue.decide, { ...choice, quantity: 20_000 });
    const bought = await clients[3].query(api.board.get, { code: "test" });

    expect(bought.player.cash).toBe(5000);
    expect(bought.player.holdings).toContainEqual({ stockKey: 8, quantity: 22_000 });
});

it("applies the old quote for one trading period except to existing unticked shareholders", async () =>
{
    const { t, sam, bob, clients, board, samCard, bobCard } = await suspensionFixture("frantic");
    const stockKey = 8;

    await t.run(async (context) =>
    {
        await context.db.patch(board.player._id, { cash: 10_000, holdings: [{ stockKey, quantity: 2000 }] });
    });
    await sam.mutation(api.rounds.beginSuspensions, { code, expectedPeriod: 1 });
    const choice = { code, expectedPeriod: 1, insightId: bobCard, stockKey };
    const bobId = board.players[1]._id;

    await expect(bob.mutation(api.rounds.suspendShare, choice)).rejects.toThrow("Choose one or more shareholders");
    await expect(bob.mutation(api.rounds.suspendShare, { ...choice, playerIds: [board.players[2]._id] }))
        .rejects.toThrow("players who hold this stock");
    await bob.mutation(api.rounds.suspendShare, { ...choice, playerIds: [bobId] });
    const selected = (await t.query(api.tv.board, { code }))?.reveal;

    expect(selected?.targetedSuspensions).toEqual([{ stockKey, playerIds: [bobId] }]);
    expect(selected?.suspended).toEqual([]);
    await expect(sam.mutation(api.rounds.suspendShare, { ...choice, insightId: samCard, playerIds: [bobId] }))
        .rejects.toThrow("already suspended");
    await sam.mutation(api.rounds.suspendShare, { code, expectedPeriod: 1, insightId: samCard });
    await sam.mutation(api.rounds.next, { code, expectedPeriod: 1 });
    const settled = await sam.query(api.board.get, { code });
    const opening = board.game.prices.find((price) => price.stockKey === stockKey)!.value;

    expect(settled.game.prices.find((price) => price.stockKey === stockKey)?.value).toBe(opening - 1);
    expect(settled.player.cash).toBe(11_000);
    expect(settled.players.find((player) => player._id === bobId)?.cash).toBe(11_000);
    expect(settled.game.tradingSuspensions).toEqual([
        { stockKey, value: opening, excludedPlayerIds: [board.player._id] },
    ]);
    expect(settled.game.targetedSuspensions).toBeUndefined();

    for (let turn = 0; turn < 12; turn++)
    {
        const quantity = [1000, 0, 1000, -1000, -1000, 0, -1000][turn] ?? 0;

        await clients[(turn + 2) % 4].mutation(api.trading.play, {
            code, expectedPeriod: 2, expectedTurn: turn, ...(quantity && { stockKey, quantity }),
        });
    }

    const pricesPaid = await t.run(async (context) => (await context.db.query("gameActions").collect())
        .filter((entry) => entry.period === 2 && entry.unitPrice !== undefined)
        .map((entry) => entry.unitPrice));

    expect(pricesPaid).toEqual([opening, opening - 1, opening, opening, opening - 1]);
    await skipDealtSuspensions(sam, code);
    await sam.mutation(api.rounds.next, { code, expectedPeriod: 2 });
    expect((await sam.query(api.board.get, { code })).game.tradingSuspensions).toBeUndefined();
});

it("replaces Frantic loans with Print Money and doubles the cash held when the card is played", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.setPack, { code, pack: "frantic" });
    await sam.mutation(api.games.start, { code });
    const board = await sam.query(api.board.get, { code });
    const insightId = await t.run(async (context) =>
    {
        const catalog = await context.db.query("gameCatalogs").first();

        expect(catalog?.cards.filter((card) => card.chanceKind === "print-money")).toHaveLength(5);
        expect(catalog?.cards.some((card) => card.chanceKind === "loan")).toBe(false);
        await context.db.patch(board.player._id, { cash: 12_345 });

        return context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
            period: 0, stockKey: chanceStockKey, chanceKind: "print-money", description: "Print Money", value: 0, resolved: false });
    });

    await sam.mutation(api.trading.activateGovernmentLoan, { code, expectedPeriod: 0, expectedTurn: 0, insightId });
    const after = await sam.query(api.board.get, { code });

    expect(after.player.cash).toBe(24_690);
    expect(after.game.turn).toBe(1);
    expect(after.feed[0]).toMatchObject({ message: "played Print Money", cashBonus: 12_345 });
    expect(await t.run((context) => context.db.get(insightId))).toMatchObject({ used: true });
});

it("redeems a Frantic Bankruptcy Buyout for £100 per share of the selected bankrupt company", async () =>
{
    const { t, sam, board, insightId, command } = await bankruptGame();

    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { pack: "frantic" });
        await context.db.patch(insightId, { chanceKind: "bankruptcy-buyout", debentureRule: "fixed-bankruptcy" });
    });
    const before = await sam.query(api.board.get, { code });

    expect(before.debentureOffers["fixed-bankruptcy"]).toEqual([
        expect.objectContaining({ stockKey: 8, quantity: 20_000, unitPrice: 100, amount: 2_000_000 }),
    ]);
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, stockKey: 7 }))
        .rejects.toThrow("Choose a bankrupt stock you own");
    await sam.mutation(api.trading.redeemDebenture, command);
    const after = await sam.query(api.board.get, { code });

    expect(after.player.cash).toBe(before.player.cash + 2_000_000);
    expect(after.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(0);
    expect(after.game.turn).toBe(before.game.turn + 1);
    expect(after.feed[0]).toMatchObject({ debenturePayout: 2_000_000, redemptionName: "Bankruptcy Buyout" });
    expect(await t.run((context) => context.db.get(insightId))).toMatchObject({ used: true });
});
