import { roster } from "../packages/npc-engine/src/roster";
import type { Difficulty } from "../packages/game-contracts/src";

export interface Result {
    personality: string;
    difficulty: Difficulty;
    heldOut: boolean;
    won: boolean;
    wealth: number;
    cashFraction: number;
    concentration: number;
    passes: number;
    actions: number;
    reversals: number;
    bluffs: number;
    following: number;
    bluffResponses: number;
    latency: number[];
    fallbacks: number;
    seed: number;
}

export function wilsonInterval(rate: number, count: number): number[]
{
    const z2 = 1.96 ** 2;
    const center = (rate + z2 / (2 * count)) / (1 + z2 / count);
    const width
        = (1.96 * Math.sqrt((rate * (1 - rate)) / count + z2 / (4 * count ** 2))) / (1 + z2 / count);

    return [center - width, center + width];
}

export function pairedComparisons(results: readonly Result[])
{
    return roster.flatMap((entry) =>
        [false, true].flatMap((heldOut) =>
            (["medium", "hard"] as const).map((difficulty) =>
            {
                const previous = difficulty === "hard" ? "medium" : "easy";
                const rows = results.filter(
                    (row) =>
                        row.personality === entry.id
                        && row.difficulty === difficulty
                        && row.heldOut === heldOut,
                );
                const deltas = rows.map(
                    (row) =>
                        row.wealth
                        - results.find(
                            (other) =>
                                other.personality === entry.id
                                && other.difficulty === previous
                                && other.seed === row.seed,
                        )!.wealth,
                );
                const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
                const error
                    = 1.96
                      * Math.sqrt(
                          deltas.reduce((sum, value) => sum + (value - mean) ** 2, 0)
                          / deltas.length
                          / deltas.length,
                      );

                return {
                    personality: entry.id,
                    heldOut,
                    comparison: `${difficulty} minus ${previous}`,
                    seeds: deltas.length,
                    averageWealthDifference: mean,
                    interval95: [mean - error, mean + error],
                };
            }),
        ),
    );
}

export function felixProxyBreakdown(results: readonly Result[])
{
    return (["easy", "medium", "hard"] as const).flatMap((difficulty) =>
        ["cautious", "following", "random-legal"].map((proxy, style) =>
        {
            const rows = results.filter(
                (row) =>
                    row.personality === "felix"
                    && row.difficulty === difficulty
                    && row.seed % 3 === style,
            );
            const mean = (function_: (row: Result) => number) =>
                rows.reduce((sum, row) => sum + function_(row), 0) / rows.length;

            return {
                difficulty,
                proxy,
                games: rows.length,
                winRate: mean((row) => Number(row.won)),
                averageWealth: mean((row) => row.wealth),
                bluffsPerGame: mean((row) => row.bluffs),
                followingPerGame: mean((row) => row.following),
                responsesPerBluff:
                    rows.reduce((sum, row) => sum + row.bluffResponses, 0)
                    / Math.max(
                        1,
                        rows.reduce((sum, row) => sum + row.bluffs, 0),
                    ),
            };
        }),
    );
}
