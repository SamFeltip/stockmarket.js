import type { Doc as Document_ } from "./_generated/dataModel";
import type { MutationCtx as MutationContext } from "./_generated/server";
import { fail, feedItem, members, roundInsights } from "./library";
import { pendingSuspensions } from "../shared/suspensions";
import { withRoleBonuses } from "../shared/company-roles";
import { roundPrices } from "../shared/settlement";
import { publicIdentity } from "./npc/identity";

export function checkSuspensionPhase(game: Document_<"games">, expectedPeriod: number)
{
    if ((game.status !== "closed" && game.status !== "special_insights") || game.currentPeriod !== expectedPeriod)
    {
        fail("The round has already changed");
    }
}

export async function spendSuspension(context: MutationContext, game: Document_<"games">,
    card: Document_<"playerInsights">, stockKey?: number)
{
    const stocks = await context.db.query("stocks").collect();
    const owner = await context.db.get(card.playerId);
    if (!owner)
    {
        fail("Player not found");
    }

    if (stockKey !== undefined)
    {
        if (!stocks.some((stock) => stock.display && stock.key === stockKey))
        {
            fail("Choose a tradable stock");
        }

        if (game.suspended.includes(stockKey))
        {
            fail("This stock is already suspended");
        }

        game = { ...game, suspended: [...game.suspended, stockKey] };
        await context.db.patch(game._id, { suspended: game.suspended });
    }

    await context.db.patch(card._id, { used: true, resolved: true });
    const display = await publicIdentity(context, owner);
    const stock = stocks.find((item) => item.key === stockKey);

    await feedItem(context, game, display.name, stock ? `suspended ${stock.name}’s price change` : "skipped Share Suspended",
        display.profileRoot, "grey");

    return game;
}

/** NPCs protect the largest loss in their portfolio, otherwise discard their card. */
export async function resolveNpcSuspensions(context: MutationContext, game: Document_<"games">)
{
    const players = await members(context, game._id);
    const insights = await roundInsights(context, game);
    const stocks = await context.db.query("stocks").collect();
    const queue = pendingSuspensions(game.currentPeriod, players, insights);
    for (const card of queue)
    {
        const owner = players.find((player) => player._id === card.playerId)!;
        if (owner.controller?.kind !== "npc")
        {
            break;
        }

        const prices = roundPrices(game.prices, withRoleBonuses(insights, players, stocks), stocks, game.suspended);
        const best = stocks.filter((stock) => stock.display && !game.suspended.includes(stock.key))
            .map((stock) => ({ key: stock.key,
                benefit: (owner.holdings.find((holding) => holding.stockKey === stock.key)?.quantity ?? 0)
                  * ((game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0)
                    - (prices.find((price) => price.stockKey === stock.key)?.value ?? 0)) }))
            .toSorted((a, b) => b.benefit - a.benefit || a.key - b.key)[0];

        game = await spendSuspension(context, game, card, best && best.benefit > 0 ? best.key : undefined);
    }
}
