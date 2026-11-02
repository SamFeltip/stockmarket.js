import { companyRoles, type CompanyRole } from "../../shared/company-roles";
import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Action } from "../../packages/game-contracts/src";
import { transition, tradeError } from "../../packages/game-contracts/src";
import { fail, feedItem, members } from "../library";
import { isCurrent } from "./seats";
import { marketFor } from "./legalActions";
export async function applyTurn(
    context: MutationContext,
    command: {
        playerId: Id<"players">;
        expectedPeriod: number;
        expectedTurn: number;
        action: Action;
    },
    display: { name: string; profileRoot: string },
): Promise<void>
{
    const player = (await context.db.get(command.playerId)) ?? fail("Unknown player");
    const game = (await context.db.get(player.gameId)) ?? fail("No game found!");
    if (game.status !== "playing" || !isCurrent(game, player))
    {
        fail("It is not your turn");
    }

    if (game.currentPeriod !== command.expectedPeriod || game.turn !== command.expectedTurn)
    {
        fail("The turn has changed; try again");
    }

    const players = await members(context, game._id);
    const action = command.action;
    const market = marketFor(game, player, players);
    let message = "passed their go";
    let roleBefore: CompanyRole | undefined;
    let roleAfter: CompanyRole | undefined;
    if (action.kind !== "pass")
    {
        const stock = await context.db
            .query("stocks")
            .withIndex("by_key", (q) => q.eq("key", action.stockKey))
            .unique();
        if (!stock?.display)
        {
            fail("This stock cannot be traded");
        }

        const error = tradeError(market, action);
        if (error)
        {
            fail(error);
        }

        roleBefore = companyRoles(players, action.stockKey).find((role) => role.playerId === player._id)?.role;
        const updated = transition(market, action).players.find((seat) => seat.id === player._id)!;

        const chairmanSince = (player.chairmanSince ?? []).filter((item) =>
            (updated.holdings.find((holding) => holding.stockKey === item.stockKey)?.quantity ?? 0) >= 100_000);
        const before = player.holdings.find((holding) => holding.stockKey === action.stockKey)?.quantity ?? 0;
        const after = updated.holdings.find((holding) => holding.stockKey === action.stockKey)?.quantity ?? 0;
        if (before < 100_000 && after >= 100_000)
        {
            chairmanSince.push({ stockKey: action.stockKey, order: game.currentPeriod * 100 + game.turn });
        }

        const updatedPlayer = { ...player, cash: updated.cash, holdings: [...updated.holdings], chairmanSince };

        roleAfter = companyRoles(players.map((seat) => seat._id === player._id ? updatedPlayer : seat), action.stockKey)
            .find((role) => role.playerId === player._id)?.role;
        await context.db.patch(player._id, { cash: updated.cash, holdings: [...updated.holdings], chairmanSince });
        message = `${action.kind === "buy" ? "bought" : "sold"} ${action.quantity} shares in ${stock.name}`;
    }

    await context.db.insert("gameActions", {
        gameId: game._id,
        period: game.currentPeriod,
        turn: game.turn,
        actorPlayerId: player._id,
        action,
    });
    const trade
        = action.kind === "pass"
            ? {}
            : {
                stockKey: action.stockKey,
                quantity: action.quantity * (action.kind === "buy" ? 1 : -1),
                roleBefore, roleAfter,
            };

    await feedItem(context, game, display.name, message, display.profileRoot, "", trade);
    const next
        = players[(players.findIndex((seat) => seat._id === player._id) + 1) % players.length];
    const turn = game.turn + 1;

    await context.db.patch(game._id, {
        turn,
        currentPlayerId: next._id,
        currentUserId: next.userId,
        status: turn >= players.length * 3 ? "closed" : "playing",
    });
}
