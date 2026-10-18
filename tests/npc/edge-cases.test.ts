import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { decide, emptyMemory } from "../../packages/npc-engine/src";
import { updateMemory } from "../../packages/npc-engine/src/memory";
import { transition } from "../../packages/game-contracts/src";
import { observation } from "./fixtures";
import { setup } from "../game-setup";
import { api, internal } from "../../convex/_generated/api";

beforeEach(() =>
{
    vi.useFakeTimers();
});
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
});
it("preserves Medium Morgan's cash reserve while rebalancing an existing portfolio", () =>
{
    const base = observation();
    const players = base.players.map((seat) =>
        seat.id === "p0"
            ? {
                ...seat,
                cash: 15_000,
                holdings: [
                    { stockKey: 7, quantity: 20_000 },
                    { stockKey: 8, quantity: 0 },
                ],
            }
            : seat,
    );
    const input = observation({ players, ownInsights: [{ id: "c", stockKey: 8, value: 3 }] });
    const result = decide(
        input,
        { personality: "morgan", difficulty: "medium" },
        emptyMemory(),
        "reserve",
    );
    const after = transition(input, result.action).players.find((seat) => seat.id === "p0")!;

    expect(after.cash).toBeGreaterThanOrEqual(55_000 * 0.2);
});
it("learns following from two separate responses and does not count the same event twice", () =>
{
    const input = observation({
        events: [
            {
                period: 0,
                turn: 0,
                actorPlayerId: "p0",
                action: { kind: "buy", stockKey: 7, quantity: 1000 },
            },
            {
                period: 0,
                turn: 1,
                actorPlayerId: "p1",
                action: { kind: "buy", stockKey: 7, quantity: 1000 },
            },
            {
                period: 0,
                turn: 4,
                actorPlayerId: "p0",
                action: { kind: "buy", stockKey: 8, quantity: 1000 },
            },
            {
                period: 0,
                turn: 5,
                actorPlayerId: "p1",
                action: { kind: "buy", stockKey: 8, quantity: 1000 },
            },
        ],
    });
    const memory = updateMemory(input, emptyMemory());

    expect(memory.followers).toEqual([{ playerId: "p1", responses: 2 }]);
    expect(updateMemory(input, memory)).toEqual(memory);
});
it("schedules an NPC in the starting seat and emergency disable leaves active turns operational", async () =>
{
    const { t, sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    const waiting = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(waiting.player._id, { seatOrder: 1 });
        await context.db.patch(waiting.players[1]._id, { seatOrder: 0 });
    });
    await sam.mutation(api.games.start, { code: "test" });
    const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

    expect(pending.turn).toBe(0);
    vi.stubEnv("NPC_DISABLE_NEW_GAMES", "true");
    await t.mutation(internal.npc.worker.run, {
        pendingId: pending._id,
        generation: pending.generation,
    });
    const board = await sam.query(api.board.get, { code: "test" });

    expect(board.game.turn).toBe(1);
    await sam.mutation(api.games.create, { code: "disabled", periodCount: 5 });
    await expect(sam.mutation(api.npc.lobby.add, { code: "disabled" })).rejects.toThrow(
        "temporarily unavailable",
    );
});
it("rejects stale previous-period human commands even when the turn number and seat match", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) => context.db.patch(board.game._id, { currentPeriod: 1 }));
    await expect(
        sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 }),
    ).rejects.toThrow("turn has changed");
    expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(0);
});
