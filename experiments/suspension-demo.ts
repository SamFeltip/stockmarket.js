import { specialDeck } from "../shared/chance-cards";
import type { Board } from "../src/types";

export function configureSuspensionDemo(board: Board, suspensionDemo: string | null)
{
    if (suspensionDemo)
    {
        board.game.status = "closed";
        board.game.turn = board.players.length * 3;
        board.game.suspended = [];
        board.game.suspensionPeriod = suspensionDemo === "reveal" ? undefined : board.game.currentPeriod;
        board.insights = board.insights.filter((card) => !card.chanceKind);
        board.insights.push(...specialDeck().filter((card) => card.chanceKind === "hold").map((card, index) => ({
            ...card, _id: `suspend-${index}` as Board["insights"][number]["_id"], _creationTime: 0,
            gameId: board.game._id, period: board.game.currentPeriod, playerId: board.players[index]._id,
            resolved: false, catalogCardId: card.id,
        })), { ...board.insights[0], _id: "suspend-market-drop" as Board["insights"][number]["_id"],
            stockKey: 12, value: -2, description: "Market downturn", resolved: false, chanceKind: undefined });
        board.feed = [];

        if (suspensionDemo === "waiting")
        {
            board.player = { ...board.player, _id: board.players[2]._id };
        }
    }
}
