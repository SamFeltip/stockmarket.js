import { v } from "convex/values";
import { internal } from "./_generated/api";
import { actionAnimationMs } from "../shared/presentation";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_ } from "./_generated/dataModel";
import { member, members, gameByCode, fail, feedItem } from "./library";
import { isCurrent } from "./game/seats";
import { finishTurn } from "./game/commands";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";
import { publicIdentity } from "./npc/identity";
import { rightsEntitlement, rightsIssueOrder, rightsIssuePrice, rightsPurchaseError, rightsAvailable } from "../shared/rights-issue";
import { companyRoles, roleQualification } from "../shared/company-roles";
import { chanceStockKey } from "../shared/chance-cards";

export const activate = mutation({
    args: { code: v.string(), expectedPeriod: v.number(), expectedTurn: v.number(),
        insightId: v.id("playerInsights"), stockKey: v.number() },
    handler: async (context, arguments_) =>
    {
        const { game, player, user } = await member(context, arguments_.code);
        if (game.rightsIssue)
        {
            fail("A Rights Issue is already in progress");
        }

        if (game.status !== "playing" || !isCurrent(game, player))
        {
            fail("It is not your turn");
        }

        if (arguments_.expectedPeriod !== game.currentPeriod || arguments_.expectedTurn !== game.turn)
        {
            fail("The turn has changed; try again");
        }

        const card = await context.db.get(arguments_.insightId);
        if (!card || card.gameId !== game._id || card.playerId !== player._id || card.period !== game.currentPeriod
          || card.stockKey !== chanceStockKey || card.chanceKind !== "rights" || card.used || card.resolved)
        {
            fail("This Rights Issue card cannot be used");
        }

        const stocks = await context.db.query("stocks").collect();
        const stock = stocks.find((item) => item.key === arguments_.stockKey && item.display);
        const seats = await members(context, game._id);
        const offers = rightsIssueOrder(seats, player._id).flatMap((seat) =>
        {
            const held = seat.holdings.find((holding) => holding.stockKey === arguments_.stockKey)?.quantity ?? 0;

            return held > 0
                ? [{ playerId: seat._id, held, maximum: rightsEntitlement(held) }] : [];
        });
        if (!stock)
        {
            fail("Choose a tradable stock");
        }

        const rightsIssue = { insightId: card._id, stockKey: stock.key, actorPlayerId: player._id,
            period: game.currentPeriod, turn: game.turn, index: 0, offers };

        await context.db.insert("gameActions", { gameId: game._id, period: game.currentPeriod, turn: game.turn,
            actorPlayerId: player._id, action: { kind: "pass" }, rightsIssueId: card._id });
        await context.db.patch(card._id, { used: true, resolved: true });

        await feedItem(context, game, user.name, `opened a Rights Issue for ${stock.name}`, user.profileRoot, "");

        if (offers.length === 0)
        {
            await finishTurn(context, game, player, seats);
            await enqueueNextNpcIfNeeded(context, game._id);

            return;
        }

        await context.db.patch(game._id, { rightsIssue });
        await advanceNpcs(context, { ...game, rightsIssue });
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});

const decisionArguments = { code: v.string(), insightId: v.id("playerInsights"), expectedIndex: v.number() };

function currentOffer(game: Document_<"games">, insightId: string, index: number)
{
    const issue = game.rightsIssue;
    if (!issue || issue.completed || game.status !== "playing" || issue.insightId !== insightId || issue.index !== index
      || issue.period !== game.currentPeriod || issue.turn !== game.turn)
    {
        fail("The Rights Issue decision has changed");
    }

    return issue;
}

export const decide = mutation({
    args: { ...decisionArguments, quantity: v.number() },
    handler: async (context, arguments_) =>
    {
        const { game, player } = await member(context, arguments_.code);
        const issue = currentOffer(game, arguments_.insightId, arguments_.expectedIndex);
        if (issue.offers[issue.index]?.playerId !== player._id)
        {
            fail("Wait for your Rights Issue choice");
        }

        await advanceNpcs(context, await purchase(context, game, arguments_.quantity));
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});

// As with suspension decisions, a public spectator can skip the current offer, never purchase for a player.
export const skip = mutation({
    args: decisionArguments,
    handler: async (context, arguments_) =>
    {
        const game = await gameByCode(context, arguments_.code);

        currentOffer(game, arguments_.insightId, arguments_.expectedIndex);
        await advanceNpcs(context, await purchase(context, game, 0));
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});

async function purchase(context: MutationContext, game: Document_<"games">, quantity: number)
{
    const issue = game.rightsIssue!;
    const offer = issue.offers[issue.index];
    const player = (await context.db.get(offer.playerId)) ?? fail("Player not found");
    const reason = rightsPurchaseError(quantity, offer.maximum, player.cash);
    if (reason)
    {
        fail(reason);
    }

    const seats = await members(context, game._id);
    if (quantity > rightsAvailable(seats, issue.stockKey))
    {
        fail("There aren't enough shares available. Try fewer shares.");
    }

    const held = player.holdings.find((holding) => holding.stockKey === issue.stockKey)?.quantity ?? 0;
    const stock = (await context.db.query("stocks").collect()).find((item) => item.key === issue.stockKey)!;
    const display = await publicIdentity(context, player);
    if (quantity > 0)
    {
        const roleBefore = companyRoles(seats, issue.stockKey).find((role) => role.playerId === player._id)?.role;
        const qualification = roleQualification(player, issue.stockKey, held + quantity,
            game.currentPeriod * 100 + game.turn + (issue.index + 1) / 100, roleBefore);

        const holdings = player.holdings.map((holding) => holding.stockKey === issue.stockKey
            ? { ...holding, quantity: held + quantity } : holding);
        const updated = { ...player, holdings, ...qualification, cash: player.cash - quantity * rightsIssuePrice };
        const roleAfter = companyRoles(seats.map((seat) => seat._id === player._id ? updated : seat), issue.stockKey)
            .find((role) => role.playerId === player._id)?.role;

        await context.db.patch(player._id, { holdings, ...qualification, cash: updated.cash });
        // Record the actual £1 purchase price without creating another bargain.
        await context.db.insert("gameActions", { gameId: game._id, period: game.currentPeriod, turn: game.turn,
            actorPlayerId: player._id, action: { kind: "buy", stockKey: issue.stockKey, quantity },
            unitPrice: rightsIssuePrice, rightsIssueId: issue.insightId });
        await feedItem(context, game, display.name, `bought ${quantity} ${stock.name} shares in the Rights Issue`,
            display.profileRoot, "", { stockKey: issue.stockKey, quantity, roleBefore, roleAfter });
    }
    else
    {
        await feedItem(context, game, display.name, `skipped the ${stock.name} Rights Issue`, display.profileRoot, "grey");
    }

    const next = { ...issue, index: issue.index + 1,
        offers: issue.offers.map((item, index) => index === issue.index ? { ...item, purchased: quantity } : item) };
    if (next.index >= next.offers.length)
    {
        const completed = { ...next, index: issue.index, completed: true };

        await context.db.patch(game._id, { rightsIssue: completed });
        await context.scheduler.runAfter(actionAnimationMs, internal.rightsIssue.finish, {
            gameId: game._id, insightId: issue.insightId,
        });

        return { ...game, rightsIssue: completed };
    }

    await context.db.patch(game._id, { rightsIssue: next });

    return { ...game, rightsIssue: next };
}

async function advanceNpcs(context: MutationContext, game: Document_<"games">)
{
    while (game.rightsIssue && !game.rightsIssue.completed)
    {
        const issue = game.rightsIssue;
        const offer = issue.offers[issue.index];
        const player = (await context.db.get(offer.playerId))!;
        if (player.controller?.kind !== "npc")
        {
            break;
        }

        const price = game.prices.find((item) => item.stockKey === issue.stockKey)?.value ?? 0;

        // Take a profitable retail offer within cash, otherwise decline it; no normal trading turn is spent.
        const available = rightsAvailable(await members(context, game._id), issue.stockKey);
        const quantity = price > rightsIssuePrice ? Math.min(offer.maximum, Math.floor(player.cash), available) : 0;

        game = await purchase(context, game, quantity);
    }
}

export const finish = internalMutation({
    args: { gameId: v.id("games"), insightId: v.id("playerInsights") },
    handler: async (context, { gameId, insightId }) =>
    {
        const game = await context.db.get(gameId);
        const issue = game?.rightsIssue;
        if (!game || !issue?.completed || issue.insightId !== insightId
          || game.currentPeriod !== issue.period || game.turn !== issue.turn)
        {
            return;
        }

        const seats = await members(context, game._id);
        const actor = seats.find((seat) => seat._id === issue.actorPlayerId)!;

        await feedItem(context, game, "Rights Issue", "Rights Issue complete. Trading resumes.",
            "/static/imgs/icons/Stock.svg", "grey");
        await context.db.patch(game._id, { rightsIssue: undefined });
        await finishTurn(context, game, actor, seats);
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});
