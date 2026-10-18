import { describe, expect, it } from "vitest";
import { decide, emptyMemory, isLegalProposal, roster } from "../../packages/npc-engine/src";
import { estimate } from "../../packages/npc-engine/src/estimate";
import { updateMemory } from "../../packages/npc-engine/src/memory";
import { plan } from "../../packages/npc-engine/src/planning";
import { observation } from "./fixtures";
import type { Difficulty, NpcObservation } from "../../packages/game-contracts/src";

describe("NPC profiles", () =>
{
    for (const personality of roster)
    {
        for (const difficulty of [
            "easy",
            "medium",
            "hard",
        ] as const satisfies readonly Difficulty[])
        {
            it(`${personality.name} ${difficulty} is deterministic, legal and leaves its input untouched`, () =>
            {
                const input = observation();
                const saved = JSON.stringify(input);
                const profile = { personality: personality.id, difficulty };
                const result = decide(input, profile, emptyMemory(), "profile-fixture");

                expect(result).toEqual(decide(input, profile, emptyMemory(), "profile-fixture"));
                expect(isLegalProposal(result.action, input.legalActions)).toBe(true);
                expect(JSON.stringify(input)).toBe(saved);
                expect(result.nextMemory.version).toBe(1);
            });
        }
    }

    it("keeps Easy Frankie's favourite even with negative cards, but never trades a zero price", () =>
    {
        const input = observation();
        const players = input.players.map((seat) =>
            seat.id === input.selfId
                ? {
                    ...seat,
                    cash: 0,
                    holdings: [
                        { stockKey: 7, quantity: 30_000 },
                        { stockKey: 8, quantity: 0 },
                    ],
                }
                : seat,
        );
        const negative = input.ownInsights.map((card) => ({ ...card, value: -1 }));

        expect(
            decide(
                observation({ players, ownInsights: negative }),
                { personality: "frankie", difficulty: "easy" },
                emptyMemory(),
                "loyal",
            ).action.kind,
        ).toBe("pass");
        expect(
            decide(
                observation({ prices: [{ stockKey: 7, value: 0 }] }),
                { personality: "frankie", difficulty: "easy" },
                emptyMemory(),
                "zero",
            ).action.kind,
        ).toBe("pass");
    });
    it("Casey cannot copy a sale without holdings", () =>
    {
        const input = observation({
            events: [
                {
                    period: 0,
                    turn: 0,
                    actorPlayerId: "p1",
                    action: { kind: "sell", stockKey: 7, quantity: 1000 },
                },
            ],
        });

        expect(
            decide(input, { personality: "casey", difficulty: "easy" }, emptyMemory(), "copy")
                .action.kind,
        ).toBe("pass");
    });
    it("Easy Ada acts on an individual positive card while Medium Ada sums contradictory cards", () =>
    {
        const input = observation({
            ownInsights: [
                { id: "a", stockKey: 7, value: 2 },
                { id: "b", stockKey: 7, value: -3 },
            ],
        });

        expect(
            decide(input, { personality: "ada", difficulty: "easy" }, emptyMemory(), "cards").action
                .kind,
        ).toBe("buy");
        expect(
            decide(input, { personality: "ada", difficulty: "medium" }, emptyMemory(), "cards")
                .action.kind,
        ).toBe("pass");
    });
    it("samples the complete remaining multiset, preserves duplicate identities and floors settlement", () =>
    {
        const catalog = Array.from({ length: 40 }, (_, index) => ({
            id: String(index),
            stockKey: 7,
            value: -1,
        }));
        const input = observation({ catalog, ownInsights: catalog.slice(0, 10) });
        const estimates = estimate(input, true, "floor");

        expect(estimates[0].outcomes.every((price) => price === 0)).toBe(true);
        expect(estimates[0].change).toBe(-2);
        expect(() =>
            estimate(
                observation({ catalog: catalog.slice(0, 20), ownInsights: catalog.slice(0, 10) }),
                true,
                "short",
            ),
        ).toThrow("cannot supply");
    });
    it("Felix reserves actions to unwind and Medium/Hard skip final-period bait", () =>
    {
        const negative = observation().ownInsights.map((card) => ({
            ...card,
            value: card.stockKey === 7 ? -1 : 1,
        }));
        const input = observation({
            ownInsights: negative,
            prices: [
                { stockKey: 7, value: 1 },
                { stockKey: 8, value: 2.5 },
            ],
        });
        const first = decide(
            input,
            { personality: "felix", difficulty: "easy" },
            emptyMemory(),
            "bait",
        );

        expect(first.reason).toBe("bluff");
        expect(first.nextMemory.bait?.quantity).toBe(1000);

        for (const difficulty of ["medium", "hard"] as const)
        {
            expect(
                decide(
                    observation({ ...input, period: 5 }),
                    { personality: "felix", difficulty },
                    emptyMemory(),
                    "final",
                ).reason,
            ).not.toBe("bluff");
            expect(
                decide(
                    observation({ ...input, actionsRemaining: 2 }),
                    { personality: "felix", difficulty },
                    emptyMemory(),
                    "budget",
                ).reason,
            ).not.toBe("bluff");
        }
    });
    it("Morgan can sell to fund a better purchase and values passing with no opportunity", () =>
    {
        const base = observation();
        const players = base.players.map((seat) =>
            seat.id === "p0"
                ? {
                    ...seat,
                    cash: 0,
                    holdings: [
                        { stockKey: 7, quantity: 30_000 },
                        { stockKey: 8, quantity: 0 },
                    ],
                }
                : seat,
        );
        const input = observation({ players, actionsRemaining: 2 });
        const estimates = [
            { stockKey: 7, change: -1, spread: 0, outcomes: [1] },
            { stockKey: 8, change: 3, spread: 0, outcomes: [5.5] },
        ];

        expect(plan(input, estimates)).toMatchObject({ kind: "sell", stockKey: 7 });
        expect(
            plan(
                base,
                estimates.map((item) => ({ ...item, change: -1, outcomes: [0] })),
            ),
        ).toEqual({ kind: "pass" });
    });
    it("updates bounded credibility once per settled period and retains the period-start leader", () =>
    {
        const input: NpcObservation = observation({
            events: [
                {
                    period: 0,
                    turn: 1,
                    actorPlayerId: "p1",
                    action: { kind: "buy", stockKey: 7, quantity: 1000 },
                },
            ],
            settledPeriods: [
                {
                    period: 0,
                    opening: [{ stockKey: 7, value: 2 }],
                    settled: [{ stockKey: 7, value: 3 }],
                },
            ],
        });
        const memory = updateMemory(input, emptyMemory());

        expect(updateMemory(input, memory)).toEqual(memory);
        expect(memory.credibility[0].scores).toEqual([1]);
        expect(memory.leaderId).toBe("p1");
    });
});
