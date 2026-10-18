import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup } from "../game-setup";
import { buildNpcObservation } from "../../convex/npc/observation";
import { decide, emptyMemory } from "../../packages/npc-engine/src";

beforeEach(() =>
{
    vi.useFakeTimers();
});
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});
describe("NPC scheduler and privacy", () =>
{
    it("runs consecutive NPCs without a browser and stops at the human and reveal", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.start, { code: "test" });

        for (let action = 0; action < 3; action++)
        {
            const board = await sam.query(api.board.get, { code: "test" });

            await sam.mutation(api.trading.play, {
                code: "test",
                expectedTurn: board.game.turn,
                expectedPeriod: 0,
            });
            await t.finishAllScheduledFunctions(vi.runAllTimers);
        }

        const closed = await sam.query(api.board.get, { code: "test" });

        expect(closed.game.status).toBe("closed");
        expect(closed.game.turn).toBe(12);
        expect(
            await t.run(async (context) => context.db.query("gameActions").collect()),
        ).toHaveLength(12);
        expect(await t.run(async (context) => context.db.query("npcTurns").collect())).toHaveLength(
            0,
        );
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        await t.finishAllScheduledFunctions(vi.runAllTimers);
        const rotated = await sam.query(api.board.get, { code: "test" });

        expect(rotated.game.currentPeriod).toBe(1);
        expect(rotated.game.turn).toBe(3);
        expect(rotated.game.currentPlayerId).toBe(rotated.player._id);
    });
    it("ignores duplicate and stale jobs and recovers overdue work with the same seed", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.start, { code: "test" });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
        const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

        await t.run(async (context) => context.db.patch(pending._id, { due: Date.now() - 60_000 }));
        await t.mutation(internal.npc.recovery.sweep, {});
        const recovered = (await t.run(async (context) => context.db.get(pending._id)))!;

        expect(recovered.seed).toBe(pending.seed);
        expect(recovered.attempts).toBe(1);
        const job = { pendingId: pending._id, generation: pending.generation };

        await t.mutation(internal.npc.worker.run, job);
        const accepted = await sam.query(api.board.get, { code: "test" });

        await t.mutation(internal.npc.worker.run, job);
        expect(await sam.query(api.board.get, { code: "test" })).toEqual(accepted);
        expect(
            await t.run(async (context) => context.db.query("gameActions").collect()),
        ).toHaveLength(2);
        const stale = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

        await t.run(async (context) => context.db.patch(stale._id, { period: -1 }));
        await t.mutation(internal.npc.worker.run, {
            pendingId: stale._id,
            generation: stale.generation,
        });
        expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(2);
    });
    it("uses a recorded normal pass after repeated failures and lets database-boundary failures roll back", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.start, { code: "test" });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
        const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

        await t.run(async (context) =>
            context.db.delete((await context.db.query("gameCatalogs").unique())!._id),
        );
        const job = { pendingId: pending._id, generation: pending.generation };

        await expect(t.mutation(internal.npc.worker.run, job)).rejects.toThrow("Missing pinned");
        expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(1);
        await t.run(async (context) => context.db.patch(pending._id, { attempts: 3 }));
        await t.mutation(internal.npc.worker.run, job);
        const trace = (await t.run(async (context) => context.db.query("npcTraces").unique()))!;

        expect(trace.action).toEqual({ kind: "pass" });
        expect(trace.diagnostic).toContain("Recovery fallback");
    });
    it("is invariant to opponents' private hands and never exposes private engine state", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.start, { code: "test" });
        const board = await sam.query(api.board.get, { code: "test" });
        const npcId = board.players[1]._id;
        const observe = () =>
            t.run(async (context) =>
                buildNpcObservation(
                    context,
                    (await context.db.get(board.game._id))!,
                    (await context.db.get(npcId))!,
                ),
            );
        const before = await observe();

        await t.run(async (context) =>
        {
            const opponentCards = await context.db
                .query("playerInsights")
                .withIndex("by_player_period", (q) =>
                    q.eq("playerId", board.player._id).eq("period", 0),
                )
                .collect();
            for (const card of opponentCards)
            {
                await context.db.patch(card._id, { value: card.value + 999 });
            }
        });
        const after = await observe();

        expect(after).toEqual(before);
        const profile = { personality: "morgan", difficulty: "hard" } as const;

        expect(decide(before, profile, emptyMemory(), "fair")).toEqual(
            decide(after, profile, emptyMemory(), "fair"),
        );
        const publicBoard = JSON.stringify(await sam.query(api.board.get, { code: "test" }));
        for (const secret of [
            "rosterSeed",
            "generation",
            "nextMemory",
            "credibility",
            "diagnostic",
            "queue",
            "observedThrough",
        ])
        {
            expect(publicBoard).not.toContain(`"${secret}"`);
        }

        expect(board.insights).toHaveLength(10);
    });
    it("rejects unsupported special catalogs before an NPC game starts", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await t.run(async (context) =>
            context.db.insert("insights", {
                key: 999,
                stockKey: 999,
                value: 0,
                description: "Hold",
            }),
        );
        await expect(sam.mutation(api.games.start, { code: "test" })).rejects.toThrow(
            "ordinary-only",
        );
    });
});
