import { api } from "../convex/_generated/api";
import { chanceStockKey, specialDeck } from "../shared/chance-cards";
import type { Pack } from "../shared/packs";
import { setup } from "./game-setup";

export async function suspensionFixture(pack: Pack = "classic")
{
    const game = await setup();
    if (pack !== "classic")
    {
        await game.sam.mutation(api.games.setPack, { code: "test", pack });
    }

    await game.sam.mutation(api.games.start, { code: "test" });
    const board = await game.sam.query(api.board.get, { code: "test" });
    const cards = await game.t.run(async (context) =>
    {
        for (const card of await context.db.query("playerInsights").collect())
        {
            await context.db.delete(card._id);
        }

        await context.db.patch(board.game._id, { status: "closed", currentPeriod: 1, turn: 12 });
        await context.db.patch(board.players[1]._id, { cash: 10_000, holdings: [{ stockKey: 8, quantity: 2000 }] });
        const ids = [];
        for (const [index, physical] of specialDeck(pack).filter((card) => card.chanceKind === "hold").slice(0, 2).entries())
        {
            ids.push(await context.db.insert("playerInsights", { gameId: board.game._id, period: 1,
                playerId: board.players[index]._id, stockKey: chanceStockKey, value: 0,
                description: physical.description, catalogCardId: physical.id, chanceKind: "hold", resolved: false }));
        }

        for (const [stockKey, value] of [[8, -1], [12, 1], [-1, 0.1]])
        {
            await context.db.insert("playerInsights", { gameId: board.game._id, period: 1,
                playerId: board.players[0]._id, stockKey, value, description: "Test movement", resolved: false });
        }

        return ids;
    });
    const closed = await game.sam.query(api.board.get, { code: "test" });

    return { ...game, board: closed, samCard: cards[0], bobCard: cards[1] };
}
