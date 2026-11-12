import { legacyTechRounds, techMarketSteps, type Pack } from "../shared/packs";

export const packPresentation = {
    classic: { name: "Classic", summary: "Trade the original stocks using the original insight and chance cards." },
    frantic: { name: "Frantic", summary: "Trade at triple the opening prices with bigger swings and extra chance cards.", icon: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z" },
    tech: { name: "Tech", summary: "Use private forecasts to trade six tech stocks through two-month periods of real market history.", icon: "M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 4h6v6H9V9ZM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" },
    crashing: { name: "Crashing", summary: "Trade the original stocks through a 30% market-wide crash every third round.", icon: "m3 6 6 6 4-4 8 10m-6 0h6v-6" },
} as const satisfies Record<Pack, { name: string; summary: string; icon?: string }>;

export function nextRoundLabel(game: { pack?: Pack; currentPeriod: number; periodCount: number })
{
    if (game.currentPeriod >= game.periodCount)
    {
        return "Finish Game";
    }

    return legacyTechRounds(game) && (game.currentPeriod + 1) % techMarketSteps !== 0
        ? "Next Round" : "Next Period";
}
