import type { Board } from "../src/types";

/** Match the authoritative one-bargain completion, including the last turn of a period. */
export function finishRightsDemo(board: Board, insightId: string): Board
{
    const issue = board.game.rightsIssue;
    if (!issue?.completed || issue.insightId !== insightId)
    {
        return board;
    }

    const turn = issue.turn + 1;
    const next = board.players[(board.players.findIndex((player) => player._id === issue.actorPlayerId) + 1)
      % board.players.length];
    const completion = { ...board.feed[0], _id: `rights-complete-${insightId}` as Board["feed"][number]["_id"],
        _creationTime: Date.now(), title: "Rights Issue", message: "Rights Issue complete. Trading resumes.",
        imageRoot: "/static/imgs/icons/Stock.svg", colour: "grey", quantity: undefined, stockKey: undefined };

    return { ...board, feed: [completion, ...board.feed], game: { ...board.game, rightsIssue: undefined,
        turn, currentPlayerId: next._id, status: turn >= board.players.length * 3 ? "closed" : "playing" } };
}
