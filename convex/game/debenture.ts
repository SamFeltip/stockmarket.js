import type { QueryCtx as QueryContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";
import { bankruptcyPeriod, purchaseCost } from "../../shared/debenture";

export async function debentureOffers(context: QueryContext, game: Document_<"games">, player: Document_<"players">)
{
    const actions = (await context.db.query("gameActions")
        .withIndex("by_game_period_turn", (q) => q.eq("gameId", game._id)).collect())
        .filter((item) => item.actorPlayerId === player._id)
        .toSorted((a, b) => a.period - b.period || a.turn - b.turn);
    const history = game.priceHistory ?? [];
    const purchases = actions.map(({ action, period, unitPrice }) => ({
        kind: action.kind,
        stockKey: "stockKey" in action ? action.stockKey : undefined,
        quantity: "quantity" in action ? action.quantity : undefined,
        unitPrice: unitPrice ?? ("stockKey" in action ? history.find((item) => item.period === period)?.prices
            .find((item) => item.stockKey === action.stockKey)?.value : undefined),
    }));
    const stocks = (await context.db.query("stocks").collect()).filter((stock) => stock.display);

    return player.holdings.filter((holding) => holding.quantity > 0
      && stocks.some((stock) => stock.key === holding.stockKey)
      && game.prices.some((price) => price.stockKey === holding.stockKey && price.value <= 0)).map((holding) =>
    {
        const bankrupt = bankruptcyPeriod(holding.stockKey, history, game.currentPeriod);
        const amount = purchaseCost(holding.stockKey, holding.quantity, purchases);
        const claimUntilPeriod = bankrupt === null ? null : bankrupt + 1;
        let unavailableReason: string | null = null;
        if (claimUntilPeriod === null)
        {
            unavailableReason = "Bankruptcy date is unavailable.";
        }
        else if (game.currentPeriod > claimUntilPeriod)
        {
            unavailableReason = "The two-round claim window has ended.";
        }
        else if (amount === null)
        {
            unavailableReason = "The purchase cost of these shares is unavailable.";
        }

        return { stockKey: holding.stockKey, quantity: holding.quantity, amount,
            unitPrice: amount === null ? null : amount / holding.quantity, claimUntilPeriod, unavailableReason };
    });
}
