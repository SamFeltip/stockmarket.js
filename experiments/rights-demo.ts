import { companyRoles } from "../shared/company-roles";
import type { Dispatch, SetStateAction } from "react";
import type { Board } from "../src/types";
import { rightsEntitlement, rightsIssueOrder, rightsPurchaseError } from "../shared/rights-issue";
import { actionAnimationMs } from "../shared/presentation";

export const rightsMode = new URLSearchParams(location.search).get("rights");

function synchronize(board: Board): Board
{
    const players = board.players.map((player) => ({ ...player,
        netWorth: player.cash + player.holdings.reduce((sum, holding) => sum + holding.quantity
        * (board.game.prices.find((price) => price.stockKey === holding.stockKey)?.value ?? 0), 0),
        roles: board.stocks.flatMap((stock) => companyRoles(board.players, stock.key)
            .filter((role) => role.playerId === player._id).map((role) => ({ stockKey: stock.key, role: role.role }))),
    }));

    return { ...board, players,
        player: { ...board.player, ...players.find((seat) => seat._id === board.player._id)! } };
}

function begin(board: Board, insightId: Board["insights"][number]["_id"], stockKey: number): Board
{
    const issue = { insightId, stockKey, actorPlayerId: board.game.currentPlayerId!,
        period: board.game.currentPeriod, turn: board.game.turn, index: 0,
        offers: rightsIssueOrder(board.players, board.game.currentPlayerId!).flatMap((player) =>
        {
            const held = player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0;

            return held > 0 ? [{ playerId: player._id, held, maximum: rightsEntitlement(held) }] : [];
        }) };

    const empty = issue.offers.length === 0;
    const next = board.players[(board.players.findIndex((player) => player._id === issue.actorPlayerId) + 1)
      % board.players.length];

    return synchronize({ ...board, game: { ...board.game, rightsIssue: empty ? undefined : issue,
        ...(empty ? { turn: issue.turn + 1, currentPlayerId: next._id,
            status: issue.turn + 1 >= board.players.length * 3 ? "closed" : "playing" } : {}) },
    insights: board.insights.map((card) => card._id === insightId
        ? { ...card, used: true, resolved: true } : card) });
}

export function configureRightsDemo(board: Board)
{
    if (!rightsMode)
    {
        return;
    }

    for (const [index, player] of board.players.entries())
    {
        player.holdings = [{ stockKey: 12, quantity: [6000, 2000, 4000, 0][index] ?? 0 }];
    }

    board.player = { ...board.player, ...board.players.find((player) => player._id === board.player._id)! };
    Object.assign(board, begin(board, board.insights.find((card) => card.chanceKind === "rights")!._id, 12));

    if (rightsMode === "waiting")
    {
        board.player = { ...board.player, ...board.players[1] };
    }
}

export function rightsDemoHandlers(board: Board, setBoard: Dispatch<SetStateAction<Board>>)
{
    return {
        activateRights: (insightId: Board["insights"][number]["_id"], stockKey: number) =>
        {
            if (board.game.currentPlayerId !== board.player._id || board.game.rightsIssue)
            {
                throw new Error("Wait for your turn");
            }

            setBoard((current) => begin(current, insightId, stockKey));

            return Promise.resolve();
        },
        decideRights: (quantity: number) =>
        {
            const issue = board.game.rightsIssue!;
            const offer = issue.offers[issue.index];
            const player = board.players.find((item) => item._id === offer.playerId)!;
            const error = rightsPurchaseError(quantity, offer.maximum, player.cash);
            if (error || issue.completed)
            {
                throw new Error(error || "The decision has changed");
            }

            const completed = issue.index + 1 === issue.offers.length;
            const holdings = player.holdings.map((holding) => holding.stockKey === issue.stockKey
                ? { ...holding, quantity: holding.quantity + quantity } : holding);
            const updated = { ...player, cash: player.cash - quantity, holdings };

            updated.netWorth = updated.cash + holdings.reduce((sum, holding) => sum + holding.quantity
            * (board.game.prices.find((price) => price.stockKey === holding.stockKey)?.value ?? 0), 0);

            setBoard((current) => synchronize({ ...current,
                game: { ...current.game, rightsIssue: { ...issue, completed,
                    index: completed ? issue.index : issue.index + 1,
                    offers: issue.offers.map((item, index) => index === issue.index
                        ? { ...item, purchased: quantity } : item) } },
                player: current.player._id === player._id ? { ...current.player, ...updated } : current.player,
                players: current.players.map((seat) => seat._id === player._id ? updated : seat) }));

            if (completed)
            {
                setTimeout(() => setBoard((current) => ({ ...current, game: { ...current.game, rightsIssue: undefined,
                    turn: issue.turn + 1, currentPlayerId: current.players[(current.players.findIndex((item) =>
                        item._id === issue.actorPlayerId) + 1) % current.players.length]._id } })), actionAnimationMs);
            }

            return Promise.resolve();
        },
    };
}
