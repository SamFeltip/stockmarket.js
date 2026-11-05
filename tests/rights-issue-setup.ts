import { setup } from "./game-setup";
import { api } from "../convex/_generated/api";
import { chanceStockKey } from "../shared/chance-cards";

export async function fixture()
{
    const game = await setup();

    await game.sam.mutation(api.games.start, { code: "test" });
    const board = await game.bob.query(api.board.get, { code: "test" });
    const insightId = await game.t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { currentPeriod: 1, turn: 6,
            currentPlayerId: board.player._id, currentUserId: board.user._id });

        for (const [index, seat] of board.players.entries())
        {
            await context.db.patch(seat._id, { cash: 10_000,
                holdings: [{ stockKey: 8, quantity: [4000, 6001, 0, 2000][index] }] });
        }

        return await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
            period: 1, stockKey: chanceStockKey, chanceKind: "rights", value: 0, description: "Rights Issue",
            resolved: false });
    });

    return { ...game, board, insightId, command: { code: "test", expectedPeriod: 1,
        expectedTurn: 6, insightId, stockKey: 8 } };
}
