import { packStocks, packStartingCash } from "../../stockmarket-shared/src/engine/packRules";
import { chooseTechStart, techTradingDates } from "../../stockmarket-shared/src/engine/techMarket";
import { packRounds, type Pack } from "../../stockmarket-shared/src/shared/packs";
import type { Doc as Document_ } from "./_generated/dataModel";
import type { MutationCtx as MutationContext } from "./_generated/server";
import { readEngine } from "./engine";
import { seedCatalog } from "./library";

export async function openingMarket(context: MutationContext, pack: Pack | undefined, standardPeriodCount: number)
{
    await seedCatalog(context);
    const techStart = pack === "tech" ? chooseTechStart(Math.random()) : undefined;
    const stocks = await packStocks(readEngine(context), pack, techStart);
    const prices = stocks.filter((stock) => stock.display)
        .map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));

    return {
        pack, techStart, standardPeriodCount: pack === "tech" ? standardPeriodCount : undefined,
        periodCount: packRounds(pack, standardPeriodCount + 1) - 1,
        prices, priceHistory: [{ period: 0, prices }],
    };
}

export async function changeLobbyPack(context: MutationContext, game: Document_<"games">, seats: Document_<"players">[], pack: Pack)
{
    if ((game.pack ?? "classic") === pack)
    {
        return;
    }

    const market = await openingMarket(context, pack, game.standardPeriodCount ?? game.periodCount);

    await context.db.patch(game._id, market);

    for (const seat of seats)
    {
        await context.db.patch(seat._id, {
            cash: packStartingCash(pack),
            holdings: market.prices.map(({ stockKey }) => ({ stockKey, quantity: 0 })),
        });
    }
}

export function publicTradingDates(game: Document_<"games">)
{
    return game.techStart === undefined || game.status === "waiting" ? undefined
        : techTradingDates(game.techStart, game.currentPeriod);
}
