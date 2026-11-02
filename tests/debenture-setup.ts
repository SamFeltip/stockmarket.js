import { api } from "../convex/_generated/api";
import { chanceStockKey, specialDeck } from "../shared/chance-cards";
import { setup } from "./game-setup";

export async function bankruptGame()
{
    const fixture = await setup();

    await fixture.sam.mutation(api.games.start, { code: "test" });
    const initial = await fixture.sam.query(api.board.get, { code: "test" });
    const physicalCard = specialDeck().find((card) => card.chanceKind === "debenture")!;
    const insightId = await fixture.t.run(async (context) =>
    {
        for (const card of await context.db.query("playerInsights").collect())
        {
            await (card.chanceKind ? context.db.delete(card._id) : context.db.patch(card._id, { value: 0 }));
        }

        return await context.db.insert("playerInsights", { gameId: initial.game._id, playerId: initial.player._id,
            period: 0, stockKey: chanceStockKey, chanceKind: "debenture", catalogCardId: physicalCard.id,
            value: 0, description: "Debenture", resolved: false });
    });

    await fixture.sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0,
        stockKey: 8, quantity: 20_000 });
    await fixture.t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "closed" });
        const card = (await context.db.query("playerInsights").collect()).find((item) => item.stockKey > 0)!;

        await context.db.patch(card._id, { stockKey: 8, value: -100 });
    });
    await fixture.sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    await fixture.t.run(async (context) => await context.db.patch(initial.game._id, {
        currentPlayerId: initial.player._id, currentUserId: initial.user._id, turn: 0,
    }));
    const board = await fixture.sam.query(api.board.get, { code: "test" });

    return { ...fixture, board, insightId, physicalCard,
        command: { code: "test", expectedTurn: 0, expectedPeriod: 1, insightId, stockKey: 8 } };
}
