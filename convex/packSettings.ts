import { packStocks, packStartingCash, validPackLength } from "../../stockmarket-shared/src/engine/packRules";
import { techTradingDates } from "../../stockmarket-shared/src/engine/techMarket";
import { gamePeriodCount, packDefaultPeriods, type Pack } from "../../stockmarket-shared/src/shared/packs";
import type { Doc as Document_ } from "./_generated/dataModel";
import type { MutationCtx as MutationContext } from "./_generated/server";
import { readEngine } from "./engine";
import { fail, seedCatalog } from "./library";

export async function openingMarket(context: MutationContext, pack: Pack | undefined, periodCount: number)
{
    await seedCatalog(context);
    const stocks = await packStocks(readEngine(context), pack);
    const prices = stocks.filter((stock) => stock.display)
        .map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));

    return {
        pack, techStart: undefined,
        periodCount,
        prices, priceHistory: [{ period: 0, prices }],
    };
}

export async function setLobbyLength(context: MutationContext, game: Document_<"games">, periodCount: number)
{
    if (!validPackLength(game.pack, periodCount))
    {
        fail("Invalid game length");
    }

    await context.db.patch(game._id, { periodCount });
}

export async function changeLobbyPack(context: MutationContext, game: Document_<"games">, seats: Document_<"players">[], pack: Pack)
{
    if ((game.pack ?? "classic") === pack)
    {
        return;
    }

    const wasTech = game.pack === "tech";
    const standardPeriodCount = wasTech ? game.standardPeriodCount ?? packDefaultPeriods() - 1 : game.periodCount;
    const techPeriodCount = wasTech ? gamePeriodCount(game) - 1 : game.techPeriodCount;
    const periodCount = pack === "tech" ? techPeriodCount ?? packDefaultPeriods(pack) - 1 : standardPeriodCount;
    const market = await openingMarket(context, pack, periodCount);

    await context.db.patch(game._id, { ...market, standardPeriodCount, techPeriodCount });

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
        : techTradingDates(game);
}
