import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup } from "../game-setup";

beforeEach(() =>
{
    vi.useFakeTimers();
});
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});
describe("Complete mixed games", () =>
{
    for (const [humans, npcs] of [
        [1, 3],
        [1, 5],
        [4, 2],
        [5, 1],
        [6, 0],
    ])
    {
        for (const lastPeriod of [5, 6, 7, 8, 9])
        {
            it(`settles ${lastPeriod + 1} periods with ${humans} humans and ${npcs} NPCs`, async () =>
            {
                const { t, sam, clients } = await setup(lastPeriod, Math.min(4, humans));
                for (let index = 4; index < humans; index++)
                {
                    const id = await t.run(async (context) =>
                        context.db.insert("users", { name: `h${index}`, profileRoot: "" }),
                    );
                    const client = t.withIdentity({ subject: `${id}|session` });

                    await client.mutation(api.games.join, { code: "test" });
                    clients.push(client);
                }

                for (let index = 0; index < npcs; index++)
                {
                    await sam.mutation(api.npc.lobby.add, { code: "test" });
                }

                await sam.mutation(api.npc.lobby.setDifficulty, {
                    code: "test",
                    difficulty: lastPeriod === 5 ? "hard" : "medium",
                });
                const clientsById = new Map(
                    await Promise.all(
                        clients.map(async (client) =>
                        {
                            const board = await client.query(api.board.get, { code: "test" });

                            return [board.player._id, client] as const;
                        }),
                    ),
                );

                await sam.mutation(api.games.start, { code: "test" });

                for (let period = 0; period <= lastPeriod; period++)
                {
                    const opened = await sam.query(api.board.get, { code: "test" });

                    expect(opened.game.currentPlayerId).toBe(
                        opened.players[period % (humans + npcs)]._id,
                    );

                    for (let turn = 0; turn < (humans + npcs) * 3; turn++)
                    {
                        const board = await sam.query(api.board.get, { code: "test" });
                        const client = clientsById.get(board.game.currentPlayerId!);
                        if (client)
                        {
                            await client.mutation(api.trading.play, {
                                code: "test",
                                expectedTurn: turn,
                                expectedPeriod: period,
                            });
                        }
                        else
                        {
                            const pending = (await t.run(async (context) =>
                                context.db.query("npcTurns").unique(),
                            ))!;

                            expect(pending).toMatchObject({
                                period,
                                turn,
                                playerId: board.game.currentPlayerId,
                            });
                            await t.mutation(internal.npc.worker.run, {
                                pendingId: pending._id,
                                generation: pending.generation,
                            });
                        }
                    }

                    const closed = await sam.query(api.board.get, { code: "test" });

                    expect(closed.game.status).toBe("closed");
                    expect(closed.insights).toHaveLength((humans + npcs) * 10);
                    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: period });
                    const settled = await sam.query(api.board.get, { code: "test" });
                    for (const price of settled.game.prices)
                    {
                        const previous = closed.game.prices.find(
                            (item) => item.stockKey === price.stockKey,
                        )!.value;
                        const delta = closed.insights
                            .filter((card) => card.stockKey === price.stockKey)
                            .reduce((sum, card) => sum + card.value, 0);

                        expect(price.value).toBe(
                            Math.max(0, Math.round((previous + delta) * 100) / 100),
                        );
                    }
                }

                const final = await sam.query(api.board.get, { code: "test" });

                expect(final.game.status).toBe("finished");
                const events = await t.run(async (context) =>
                    context.db.query("gameActions").collect(),
                );

                expect(events).toHaveLength((lastPeriod + 1) * (humans + npcs) * 3);
                expect(new Set(events.map((event) => `${event.period}:${event.turn}`)).size).toBe(
                    events.length,
                );
                const traces = await t.run(async (context) =>
                    context.db.query("npcTraces").collect(),
                );

                expect(traces.every((trace) => !trace.diagnostic)).toBe(true);
                expect(
                    await t.run(async (context) => context.db.query("npcTurns").collect()),
                ).toHaveLength(0);
            });
        }
    }

    it("preserves an underway two-human legacy game and backfills it without adding seats", async () =>
    {
        const { t, sam, bob } = await setup(5, 2);
        const initial = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            await context.db.patch(initial.game._id, {
                status: "playing",
                rulesVersion: undefined,
                currentPlayerId: undefined,
            });

            for (const seat of initial.players)
            {
                await context.db.patch(seat._id, { controller: undefined, seatOrder: undefined });
            }
        });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
        await t.mutation(internal.migrations.backfillSeats, { cursor: null });
        expect((await t.mutation(internal.migrations.validateSeats, {})).invalid).toEqual([]);
        await bob.mutation(api.trading.play, { code: "test", expectedTurn: 1, expectedPeriod: 0 });
        expect((await sam.query(api.board.get, { code: "test" })).players).toHaveLength(2);
        expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(2);
    });
});
