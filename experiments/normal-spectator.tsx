import { RightsIssue } from "../src/RightsIssue";
import { SpectatorScreen } from "../src/spectator/SpectatorPage";
import type { Board } from "../src/types";
import { spectatorBoard } from "../src/spectator-board";

/** Render the actual normal-play web spectator screen with the offline game fixture. */
export function NormalSpectatorDemo({ board }: { board: Board })
{
    const publicBoard = spectatorBoard(board);

    return <div className="web-spectator"><SpectatorScreen board={publicBoard} /></div>;
}

export function RightsSpectatorDemo({ board, onDecision }: {
    board: Board; onDecision: (quantity: number) => Promise<unknown>;
})
{
    return board.game.rightsIssue
        ? <RightsIssue board={board} spectator onDecision={onDecision} /> : <NormalSpectatorDemo board={board} />;
}
