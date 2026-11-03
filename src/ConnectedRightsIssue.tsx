import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { RightsIssue } from "./RightsIssue";
import type { Board } from "./types";

export function ConnectedRightsIssue({ board, onDecision }: {
    board: Board; onDecision?: (quantity: number) => Promise<unknown>;
})
{
    const decide = useMutation(api.rightsIssue.decide);
    const issue = board.game.rightsIssue!;

    return (
        <RightsIssue
            board={board}
            playerId={board.player._id}
            onDecision={onDecision ?? ((quantity) =>
                decide({ code: board.game.code, insightId: issue.insightId, expectedIndex: issue.index, quantity }))}
        />
    );
}
