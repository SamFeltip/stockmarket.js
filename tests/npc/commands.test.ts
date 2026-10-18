import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as engine from "../../packages/npc-engine/src";
import type { Action } from "../../packages/game-contracts/src";
import { api, internal } from "../../convex/_generated/api";
import { setup } from "../game-setup";

vi.mock("../../packages/npc-engine/src", async (original) =>
{
    const actual = await original<typeof engine>();

    return { ...actual, decide: vi.fn(actual.decide) };
});
beforeEach(() =>
{
    vi.useFakeTimers();
});
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.mocked(engine.decide).mockReset();
});

for (const action of [
    { kind: "pass" },
    { kind: "buy", stockKey: 8, quantity: 1000 },
    { kind: "sell", stockKey: 8, quantity: 1000 },
] as const satisfies readonly Action[])
{
    it(`applies identical ${action.kind} results through human and NPC adapters`, async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
        await sam.mutation(api.games.start, { code: "test" });
        const opened = await sam.query(api.board.get, { code: "test" });
        const npcId = opened.players[1]._id;
        if (action.kind === "sell")
        {
            await t.run(async (context) =>
            {
                for (const id of [opened.player._id, npcId])
                {
                    const player = (await context.db.get(id))!;

                    await context.db.patch(id, {
                        holdings: player.holdings.map((holding) =>
                            holding.stockKey === 8 ? { ...holding, quantity: 1000 } : holding,
                        ),
                    });
                }
            });
        }

        await sam.mutation(api.trading.play, {
            code: "test",
            expectedTurn: 0,
            expectedPeriod: 0,
            ...(action.kind === "pass"
                ? {}
                : {
                    stockKey: action.stockKey,
                    quantity: action.quantity * (action.kind === "sell" ? -1 : 1),
                }),
        });
        vi.mocked(engine.decide).mockReturnValue({
            action,
            reason: "cards",
            nextMemory: engine.emptyMemory(),
        });
        const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

        await t.mutation(internal.npc.worker.run, {
            pendingId: pending._id,
            generation: pending.generation,
        });
        const board = await sam.query(api.board.get, { code: "test" });
        const npc = board.players.find((seat) => seat._id === npcId)!;

        expect(npc.cash).toBe(board.player.cash);
        expect(npc.holdings).toEqual(board.player.holdings);
        const events = await t.run(async (context) => context.db.query("gameActions").collect());

        expect(events.map((event) => event.action)).toEqual([action, action]);
        expect(board.game.turn).toBe(2);
        expect(board.feed.filter((item) => item.title !== "game started")).toHaveLength(2);
    });
}

it("records one fallback pass for a malformed proposal and ignores a deleted game's scheduled turn", async () =>
{
    const { t, sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    await sam.mutation(api.games.start, { code: "test" });
    await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
    vi.mocked(engine.decide).mockReturnValue({
        action: { kind: "buy", stockKey: 8, quantity: Number.NaN },
        nextMemory: engine.emptyMemory(),
        reason: "cards",
    });
    const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

    await t.mutation(internal.npc.worker.run, {
        pendingId: pending._id,
        generation: pending.generation,
    });
    const trace = (await t.run(async (context) => context.db.query("npcTraces").unique()))!;

    expect(trace.action).toEqual({ kind: "pass" });
    expect(trace.diagnostic).toBe("Invalid proposed action");
    const next = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

    await t.run(async (context) => context.db.delete(next.gameId));
    await t.mutation(internal.npc.worker.run, { pendingId: next._id, generation: next.generation });
    expect(await t.run(async (context) => context.db.query("gameActions").collect())).toHaveLength(
        2,
    );
});
it("retries unexpected engine failures with a stable token before committing one fallback pass", async () =>
{
    const { t, sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    await sam.mutation(api.games.start, { code: "test" });
    await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
    vi.mocked(engine.decide).mockImplementation(() =>
    {
        throw new Error("Engine failure fixture");
    });
    const original = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;
    const job = { pendingId: original._id, generation: original.generation };
    for (let attempt = 1; attempt <= 2; attempt++)
    {
        await t.mutation(internal.npc.worker.run, job);
        const pending = (await t.run(async (context) => context.db.get(original._id)))!;

        expect(pending).toMatchObject({
            attempts: attempt,
            generation: original.generation,
            seed: original.seed,
        });
        expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(1);
    }

    await t.mutation(internal.npc.worker.run, job);
    const trace = (await t.run(async (context) => context.db.query("npcTraces").unique()))!;

    expect(trace.action).toEqual({ kind: "pass" });
    expect(trace.diagnostic).toContain("repeated attempts");
    expect(trace.attempts).toBe(2);
    expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(2);
});
it("uses the current NPC's individual difficulty without changing its neighbours", async () =>
{
    const { t, sam } = await setup(5, 1);

    await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
    const waiting = await sam.query(api.board.get, { code: "test" });

    await sam.mutation(api.npc.lobby.setDifficulty, {
        code: "test",
        playerId: waiting.players[1]._id,
        difficulty: "hard",
    });
    const configured = await sam.query(api.board.get, { code: "test" });

    expect(configured.players[1].npcDifficulty).toBe("hard");
    expect(configured.players[2].npcDifficulty).toBe("medium");
    await sam.mutation(api.games.start, { code: "test" });
    await expect(
        sam.mutation(api.npc.lobby.setDifficulty, {
            code: "test",
            playerId: waiting.players[1]._id,
            difficulty: "easy",
        }),
    ).rejects.toThrow("while waiting");
    await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
    vi.mocked(engine.decide).mockReturnValue({
        action: { kind: "pass" },
        reason: "retain-cash",
        nextMemory: engine.emptyMemory(),
    });
    const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;

    await t.mutation(internal.npc.worker.run, {
        pendingId: pending._id,
        generation: pending.generation,
    });
    expect(vi.mocked(engine.decide).mock.calls.at(-1)?.[1].difficulty).toBe("hard");
});
