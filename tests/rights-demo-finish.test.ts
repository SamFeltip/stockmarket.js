import { expect, it } from "vitest";
import raw from "../experiments/cash-dock-board.json";
import type { Board } from "../src/types";
import { finishRightsDemo } from "../experiments/rights-demo-finish";

function fixture(lastTurn: boolean): Board
{
    const board = structuredClone(raw) as unknown as Board;
    const insightId = board.insights[0]._id;
    const turn = lastTurn ? board.players.length * 3 - 1 : 0;

    board.game.turn = turn;
    board.game.status = "playing";
    board.game.rightsIssue = { insightId, actorPlayerId: board.players[0]._id,
        stockKey: 8, period: board.game.currentPeriod, turn, index: 0, completed: true,
        offers: [{ playerId: board.players[0]._id, held: 2000, maximum: 1000, purchased: 1000 }] };

    return board;
}

it("resumes after exactly one bargain and records completion in the demo feed", () =>
{
    const board = fixture(false);
    const after = finishRightsDemo(board, board.game.rightsIssue!.insightId);

    expect(after.game).toMatchObject({ turn: 1, currentPeriod: board.game.currentPeriod,
        currentPlayerId: board.players[1]._id, status: "playing", rightsIssue: undefined });
    expect(after.feed[0].message).toBe("Rights Issue complete. Trading resumes.");
    expect(after.players).toEqual(board.players);
    expect(finishRightsDemo(after, board.game.rightsIssue!.insightId)).toBe(after);
});

it("closes trading when the initiating bargain was the last turn of the period", () =>
{
    const board = fixture(true);
    const after = finishRightsDemo(board, board.game.rightsIssue!.insightId);

    expect(after.game).toMatchObject({ status: "closed", turn: board.players.length * 3,
        currentPeriod: board.game.currentPeriod });
    expect(finishRightsDemo(board, "stale-card")).toBe(board);
});
