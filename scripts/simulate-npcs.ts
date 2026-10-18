import { roster } from "../packages/npc-engine/src";
import { simulate } from "./npc-simulation";
import { wilsonInterval, pairedComparisons, felixProxyBreakdown } from "./npc-statistics";
import type { Result } from "./npc-statistics";

export function runSimulations(seedCount = 200)
{
    const results: Result[] = [];
    for (let index = 0; index < seedCount; index++)
    {
        const heldOut = index >= Math.floor(seedCount * 0.8);
        const seed = (heldOut ? 300_000 : 0) + index;
        for (const entry of roster)
        {
            for (const difficulty of ["easy", "medium", "hard"] as const)
            {
                results.push(simulate(seed, { personality: entry.id, difficulty }, heldOut));
            }
        }
    }

    const groups = roster.flatMap((entry) =>
        (["easy", "medium", "hard"] as const).flatMap((difficulty) =>
            [false, true].map((heldOut) =>
            {
                const rows = results.filter(
                    (result) =>
                        result.personality === entry.id
                        && result.difficulty === difficulty
                        && result.heldOut === heldOut,
                );
                const mean = (function_: (row: Result) => number) =>
                    rows.reduce((sum, row) => sum + function_(row), 0) / rows.length;
                const winRate = mean((row) => Number(row.won));
                const averageWealth = mean((row) => row.wealth);
                const standardError = Math.sqrt(
                    mean((row) => (row.wealth - averageWealth) ** 2) / rows.length,
                );
                const latency = rows.flatMap((row) => row.latency).toSorted((a, b) => a - b);

                return {
                    personality: entry.id,
                    difficulty,
                    heldOut,
                    games: rows.length,
                    winRate,
                    winRateInterval95: wilsonInterval(winRate, rows.length),
                    averageWealth,
                    wealthInterval95: [
                        averageWealth - 1.96 * standardError,
                        averageWealth + 1.96 * standardError,
                    ],
                    cashUtilisation: 1 - mean((row) => row.cashFraction),
                    concentration: mean((row) => row.concentration),
                    passRate: mean((row) => row.passes / row.actions),
                    reversalsPerGame: mean((row) => row.reversals),
                    bluffsPerGame: mean((row) => row.bluffs),
                    followingPerGame: mean((row) => row.following),
                    responsesPerBluff:
                        rows.reduce((sum, row) => sum + row.bluffResponses, 0)
                        / Math.max(
                            1,
                            rows.reduce((sum, row) => sum + row.bluffs, 0),
                        ),
                    p95DecisionMs: latency[Math.floor(latency.length * 0.95)],
                    fallbacks: rows.reduce((sum, row) => sum + row.fallbacks, 0),
                };
            }),
        ),
    );

    return {
        engineVersion: 1,
        tuningVersion: 1,
        seedCount,
        games: results.length,
        seedSets: {
            training: results
                .filter(
                    (row) =>
                        !row.heldOut && row.personality === "frankie" && row.difficulty === "easy",
                )
                .map((row) => row.seed),
            heldOut: results
                .filter(
                    (row) =>
                        row.heldOut && row.personality === "frankie" && row.difficulty === "easy",
                )
                .map((row) => row.seed),
        },
        method: "Paired deals, shuffled seats, 4–6 players, 6–10 periods, medium NPC opponents, cautious/following/random-legal proxy. Wilson win-rate and normal wealth/difference 95% intervals; final metrics per focus NPC.",
        groups,
        pairedComparisons: pairedComparisons(results),
        felixProxyBreakdown: felixProxyBreakdown(results),
    };
}
