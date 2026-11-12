import { legacyTechRounds, rulesForPack, techMarketSteps, type Pack } from "../shared/packs";
import { rightsPriceFor } from "../shared/rights-issue";
import type { ChanceKind } from "../shared/chance-cards";

const standardChanceEffects: Partial<Record<ChanceKind, string>> = {};
const standardDisplay = {
    chart: { calendarDates: false, groupTradesByPeriod: false, priceDots: true },
    rightsDescription: "Buy one extra share for every two you own at £1.",
    chanceEffects: standardChanceEffects,
};

export const packPresentation = {
    classic: {
        ...standardDisplay,
        name: "Classic", summary: "Trade the original stocks using the original insight and chance cards.",
    },
    frantic: {
        ...standardDisplay,
        name: "Frantic", summary: "Trade at triple the opening prices with bigger swings and extra chance cards.",
        icon: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z",
        rightsDescription: "Buy up to 10 extra shares at £1 each for every share you held when the issue opened.",
        chanceEffects: { hold: "Suspend the price change for chosen shareholders" },
    },
    tech: {
        ...standardDisplay,
        name: "Tech", summary: "Use private forecasts to trade six tech stocks through two-month periods of real market history.",
        icon: "M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 4h6v6H9V9ZM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3",
        chart: { calendarDates: true, groupTradesByPeriod: true, priceDots: false },
        rightsDescription: "Buy one extra share for every two you own at 20% off the market price.",
        chanceEffects: { rights: "Buy extra shares at 20% off" },
    },
} as const satisfies Record<Pack, typeof standardDisplay & { name: string; summary: string; icon?: string }>;

export function presentationForPack(pack: Pack = "classic"): typeof standardDisplay
{
    return packPresentation[pack];
}

export function rightsPriceLabel(pack: Pack | undefined, marketPrice: number)
{
    return rulesForPack(pack).rights.marketPricePercent === undefined ? "£1" : `£${rightsPriceFor(pack, marketPrice).toFixed(2)}`;
}

export function nextRoundLabel(game: { pack?: Pack; currentPeriod: number; periodCount: number })
{
    if (game.currentPeriod >= game.periodCount)
    {
        return "Finish Game";
    }

    return legacyTechRounds(game) && (game.currentPeriod + 1) % techMarketSteps !== 0
        ? "Next Round" : "Next Period";
}
