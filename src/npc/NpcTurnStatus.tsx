import type { Board } from "../types";
export function NpcTurnStatus({ board }: { board: Board })
{
    const current = board.players.find((seat) => seat._id === board.game.currentPlayerId);

    return (
        <h3 role="status" aria-live="polite">
            {current?.kind === "npc"
                ? `${current.name.split(" ")[0]} is considering a move…`
                : `It's ${current?.name ?? "someone"}'s turn!`}
        </h3>
    );
}
