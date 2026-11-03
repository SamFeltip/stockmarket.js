import { expect, it } from "vitest";
import type { SetStateAction } from "react";
import type { Board } from "../src/types";
import raw from "../experiments/cash-dock-board.json";
import { rightsDemoHandlers } from "../experiments/rights-demo";
import { chanceStockKey } from "../shared/chance-cards";

it("activates a held company from the demo footer without changing the current bargain or period", async () =>
{
    let board = structuredClone(raw) as unknown as Board;

    board.game.status = "playing";
    board.game.currentPlayerId = board.player._id;
    board.insights[0] = { ...board.insights[0], playerId: board.player._id, stockKey: chanceStockKey,
        chanceKind: "rights", used: false, resolved: false, period: board.game.currentPeriod };
    const original = { turn: board.game.turn, period: board.game.currentPeriod, players: board.players };

    const setBoard = (update: SetStateAction<Board>) =>
    {
        board = typeof update === "function" ? update(board) : update;
    };

    await rightsDemoHandlers(board, setBoard).activateRights(board.insights[0]._id, 8);
    expect(board.game.rightsIssue).toMatchObject({ stockKey: 8, index: 0, turn: original.turn });
    expect(board.game.rightsIssue!.offers).toHaveLength(2);
    expect(board.game.rightsIssue!.offers[0].playerId).toBe(board.player._id);
    expect(board.game.currentPeriod).toBe(original.period);
    expect(board.insights[0]).toMatchObject({ used: true, resolved: true });
    expect(board.players.map((player) => player.holdings)).toEqual(original.players.map((player) => player.holdings));
    expect(board.feed[0].message).toContain("opened a Rights Issue");
});
