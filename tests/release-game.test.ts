import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { chanceStockKey } from "../shared/chance-cards";
import { previewRound } from "../src/round-preview";
import { setup, skipDealtSuspensions } from "./game-setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});

for (const tvControlled of [false, true])
{
    it(`plays chance cards and settles all six periods with ${tvControlled ? "TV" : "phone"} controls`, async () =>
    {
        const { t, sam, clients } = await setup();
        const code = tvControlled ? "release-tv" : "test";
        const token = "c".repeat(64);
        if (tvControlled)
        {
            await t.mutation(api.tv.create, { code, periodCount: 5, token });

            for (const client of clients)
            {
                await client.mutation(api.games.join, { code });
            }

            await t.mutation(api.tv.start, { code, token });
        }
        else
        {
            await sam.mutation(api.games.start, { code });
        }

        const initial = await sam.query(api.board.get, { code });
        // Script a known first hand; every action below runs the production Convex handlers.
        const cards = await t.run(async (context) =>
        {
            for (const card of await context.db.query("playerInsights")
                .withIndex("by_game_period", (q) => q.eq("gameId", initial.game._id).eq("period", 0)).collect())
            {
                await context.db.delete(card._id);
            }

            const ids = [];
            for (const [index, chanceKind] of (["rights", "loan", "hold"] as const).entries())
            {
                ids.push(await context.db.insert("playerInsights", { gameId: initial.game._id,
                    playerId: initial.players[index]._id, period: 0, stockKey: chanceStockKey,
                    chanceKind, value: 0, description: chanceKind, resolved: false }));
            }

            await context.db.insert("playerInsights", { gameId: initial.game._id,
                playerId: initial.player._id, period: 0, stockKey: 8,
                value: -1, description: "Market fall", resolved: false });
            await context.db.insert("playerInsights", { gameId: initial.game._id,
                playerId: initial.player._id, period: 0, stockKey: -1,
                value: 0.1, description: "Cash +10%", resolved: false });

            return ids;
        });
        for (let period = 0; period <= 5; period++)
        {
            for (let turn = 0; turn < 12; turn++)
            {
                const client = clients[(period + turn) % 4];
                const command = { code, expectedPeriod: period, expectedTurn: turn };
                if (period === 0 && turn === 0)
                {
                    await client.mutation(api.trading.play, { ...command, stockKey: 8, quantity: 2000 });
                }
                else if (period === 0 && turn === 1)
                {
                    await client.mutation(api.trading.activateGovernmentLoan, { ...command, insightId: cards[1] });
                    expect((await t.query(api.tv.board, { code }))!.feed[0].cashBonus).toBe(10_000);
                }
                else if (period === 0 && turn === 4)
                {
                    await client.mutation(api.rightsIssue.activate, { ...command, insightId: cards[0], stockKey: 8 });
                    const paused = (await t.query(api.tv.board, { code }))!;

                    expect(paused.game.rightsIssue?.offers).toMatchObject([{ held: 2000, maximum: 1000 }]);
                    expect(paused.reveal).toBeNull();
                    await client.mutation(api.rightsIssue.decide, {
                        code, insightId: cards[0], expectedIndex: 0, quantity: 1000,
                    });
                    expect((await t.query(api.tv.board, { code }))!.game.turn).toBe(4);
                    await t.finishAllScheduledFunctions(vi.runAllTimers);
                    const resumed = await sam.query(api.board.get, { code });

                    expect(resumed.game.turn).toBe(5);
                    expect(resumed.player.cash).toBe(54_000);
                    expect(resumed.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(3000);
                }
                else
                {
                    await client.mutation(api.trading.play, command);
                }
            }

            if (period === 0)
            {
                await expect(t.mutation(api.rounds.nextSpectator, { code, expectedPeriod: period }))
                    .rejects.toThrow("Share Suspended");
                await t.mutation(api.rounds.beginSuspensions, { code, expectedPeriod: period });
                await clients[2].mutation(api.rounds.suspendShare, {
                    code, expectedPeriod: period, insightId: cards[2], stockKey: 8,
                });
            }
            else
            {
                await skipDealtSuspensions(t, code);
            }

            const closed = await sam.query(api.board.get, { code });
            const preview = previewRound(closed, closed.insights, closed.stocks.map((stock) => stock.key));
            if (tvControlled)
            {
                await expect(sam.mutation(api.rounds.next, { code, expectedPeriod: period })).rejects.toThrow("TV remote");
                await expect(t.mutation(api.tv.next, { code, expectedPeriod: period, token: "d".repeat(64) }))
                    .rejects.toThrow("Only the controlling TV");
                await t.mutation(api.tv.next, { code, expectedPeriod: period, token });
                await expect(t.mutation(api.tv.next, { code, expectedPeriod: period, token }))
                    .rejects.toThrow("already changed");
            }
            else
            {
                await sam.mutation(api.rounds.next, { code, expectedPeriod: period });
            }

            const settled = await sam.query(api.board.get, { code });

            expect(settled.game.prices).toEqual(preview.game.prices);
            expect(settled.players.map(({ cash, netWorth }) => ({ cash, netWorth })))
                .toEqual(preview.players.map(({ cash, netWorth }) => ({ cash, netWorth })));
            expect(settled.game.status).toBe(period === 5 ? "finished" : "playing");
            expect((await t.query(api.tv.board, { code }))!.reveal).toBeNull();

            if (period === 0)
            {
                expect(settled.player.cash).toBe(59_000);
                expect(settled.game.prices.find((price) => price.stockKey === 8)?.value).toBe(2.5);
            }
        }

        const actions = await t.run(async (context) => await context.db.query("gameActions")
            .withIndex("by_game_period_turn", (q) => q.eq("gameId", initial.game._id)).collect());
        const bargains = actions.filter((item) => !item.rightsIssueId || item.action.kind === "pass");

        expect(bargains).toHaveLength(72);
        expect(new Set(bargains.map((item) => `${item.period}:${item.turn}`)).size).toBe(72);
    });
}

it("pauses and resumes a real NPC schedule around Rights Issue decisions", async () =>
{
    const { t, sam, bob, pat } = await setup(5, 3);

    await sam.mutation(api.npc.lobby.add, { code: "test" });
    await sam.mutation(api.games.start, { code: "test" });
    await sam.mutation(api.trading.play, { code: "test", expectedPeriod: 0, expectedTurn: 0 });
    await bob.mutation(api.trading.play, { code: "test", expectedPeriod: 0, expectedTurn: 1 });
    const board = await pat.query(api.board.get, { code: "test" });
    const npc = board.players.find((player) => player.kind === "npc")!;
    const insightId = await t.run(async (context) =>
    {
        for (const playerId of [board.player._id, npc._id])
        {
            await context.db.patch(playerId, { holdings: [{ stockKey: 8, quantity: 2000 }] });
        }

        return await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
            period: 0, stockKey: chanceStockKey, chanceKind: "rights", value: 0,
            description: "Rights Issue", resolved: false });
    });

    await pat.mutation(api.rightsIssue.activate, {
        code: "test", expectedPeriod: 0, expectedTurn: 2, insightId, stockKey: 8,
    });
    expect(await t.run(async (context) => await context.db.query("npcTurns").collect())).toEqual([]);
    await pat.mutation(api.rightsIssue.decide, { code: "test", insightId, expectedIndex: 0, quantity: 1000 });
    const paused = await pat.query(api.board.get, { code: "test" });

    expect(paused.game.turn).toBe(2);
    expect(paused.game.rightsIssue?.completed).toBe(true);
    expect(paused.game.rightsIssue?.offers[1]).toMatchObject({ playerId: npc._id, purchased: 1000 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const resumed = await pat.query(api.board.get, { code: "test" });

    expect(resumed.game.rightsIssue).toBeUndefined();
    expect(resumed.game.turn).toBe(4);
    expect(resumed.game.currentPlayerId).toBe(board.players[0]._id);
    const traces = await t.run(async (context) => await context.db.query("npcTraces").collect());

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ playerId: npc._id, period: 0, turn: 3 });
    expect(traces[0].diagnostic).toBeUndefined();
});
