import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_ } from "./_generated/dataModel";
import { minimumPlayers, maximumPlayers, validGameLength } from "../shared/rules";
import { deal, fail, feedItem, members } from "./library";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";

export async function launchGame(context: MutationContext, game: Document_<"games">)
{
    if (game.status !== "waiting")
    {
        fail("The game has already started");
    }

    const players = await members(context, game._id);
    if (players.length < minimumPlayers)
    {
        fail("At least four players are required");
    }

    if (!validGameLength(game.periodCount))
    {
        fail("Invalid game length");
    }

    if (players.length > maximumPlayers || !players.some((seat) => seat.userId))
    {
        fail("Invalid player roster");
    }

    const hasNpcs = players.some((seat) => seat.controller?.kind === "npc");
    if (hasNpcs && process.env.NPC_DISABLE_NEW_GAMES === "true")
    {
        fail("New NPC games are temporarily unavailable");
    }

    const cards = await context.db.query("insights").collect();
    const stocks = await context.db.query("stocks").collect();
    if (hasNpcs && cards.some((card) => !stocks.some((stock) => stock.key === card.stockKey && stock.display)))
    {
        fail("NPC games require an ordinary-only insight catalog");
    }

    const catalogVersion = `catalog:${game._id}`;

    await context.db.insert("gameCatalogs", { gameId: game._id, version: catalogVersion,
        cards: cards.map((card) => ({ id: String(card._id), stockKey: card.stockKey, value: card.value,
            description: card.description })) });

    for (const [index, seat] of players.entries())
    {
        await context.db.patch(seat._id, { seatOrder: index, periodStartRanking: index + 1,
            controller: seat.controller ?? { kind: "human", userId: seat.userId! } });
    }

    await deal(context, game, players);
    await context.db.patch(game._id, { status: "playing", currentPlayerId: players[0]._id,
        currentUserId: players[0].userId, rulesVersion: 2, catalogVersion });
    await feedItem(context, game, "game started", "game started", "/static/imgs/icons/Handshake.svg", "grey");
    await enqueueNextNpcIfNeeded(context, game._id);
}
