import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup } from "../game-setup";
import { buildNpcObservation } from "../../convex/npc/observation";
import { decide, emptyMemory, roster } from "../../../stockmarket-shared/src/packages/npc-engine/src";
import { prepareNpcState, decideNpcTurn, fallbackNpcTurn, createNpcGameConfig } from "../../../stockmarket-shared/src/npc";
import { observation } from "./fixtures";

beforeEach(() => vi.useFakeTimers());
afterEach(() =>
{
    vi.clearAllTimers();
    vi.useRealTimers();
});

for (const entry of roster)
{
    for (const difficulty of ["easy", "medium", "hard"] as const)
    {
        it(`preserves ${entry.id}/${difficulty} decisions and persisted state through the live worker`, async () =>
        {
            const { t, sam } = await setup(5, 1);

            await sam.mutation(api.npc.lobby.add, { code: "test", required: true });
            await sam.mutation(api.games.start, { code: "test" });
            await sam.mutation(api.trading.play, { code: "test", expectedPeriod: 0, expectedTurn: 0 });
            const pending = (await t.run(async (context) => context.db.query("npcTurns").unique()))!;
            const profile = { personality: entry.id, difficulty };
            const input = await t.run(async (context) =>
            {
                await context.db.patch(pending.playerId, {
                    controller: { kind: "npc", personality: entry.id }, npcDifficulty: difficulty,
                });

                return buildNpcObservation(context, (await context.db.get(pending.gameId))!,
                    (await context.db.get(pending.playerId))!);
            });
            const expected = decide(input, profile, emptyMemory(), pending.seed);

            await t.mutation(internal.npc.worker.run, { pendingId: pending._id, generation: pending.generation });
            const trace = (await t.run(async (context) => context.db.query("npcTraces").unique()))!;
            const state = (await t.run(async (context) => context.db.query("npcStates")
                .withIndex("by_player", (query) => query.eq("playerId", pending.playerId)).unique()))!;

            expect(trace.action).toEqual(expected.action);
            expect(trace.reason).toBe(expected.reason);
            expect(trace.diagnostic).toBeUndefined();
            expect(state.memory).toBe(JSON.stringify(expected.nextMemory));
            expect(state.version).toBe(1);
        });
    }
}

it("continues existing serialized memories and preserves state validation and fallback semantics", () =>
{
    const profile = { personality: "casey", difficulty: "hard" } as const;
    const input = observation();
    const memory = decide(input, profile, emptyMemory(), "first").nextMemory;
    const saved = { memory: JSON.stringify(memory), version: 1 };
    const state = prepareNpcState(saved);
    const result = decideNpcTurn({ observation: input, profile }, state, "next", createNpcGameConfig("roster"));
    const expected = decide(input, profile, memory, "next");

    expect(result.action).toEqual(expected.action);
    expect(result.reason).toBe(expected.reason);
    expect(JSON.parse(result.state.memory)).toEqual(expected.nextMemory);
    expect(fallbackNpcTurn(state)).toMatchObject({ action: { kind: "pass" }, state, reason: "retain-cash" });
    expect(() => prepareNpcState({ ...saved, version: 99 })).toThrow("Unsupported NPC memory version");
    expect(() => prepareNpcState({ memory: "invalid-json", version: 1 })).toThrow();
    expect(prepareNpcState({ memory: "invalid-json", version: 99 }, true)).toEqual(prepareNpcState(null));

    for (const versions of [null, { engineVersion: 99, tuningVersion: 1 }, { engineVersion: 1, tuningVersion: 99 }])
    {
        expect(() => decideNpcTurn({ observation: input, profile }, state, "next", versions))
            .toThrow("Unsupported pinned engine version");
    }
});
