import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { buildNpcObservation } from "../../convex/npc/observation";
import { chanceStockKey } from "../../shared/chance-cards";
import { setup } from "../game-setup";

const testTech = it.each([false, true]);

testTech("preserves Tech's forecast and current chance hand with legacy timing %s", async (legacy) =>
{
    const { t, sam } = await setup(5, 1);
    const code = "test";

    await sam.mutation(api.games.setPack, { code, pack: "tech" });
    await sam.mutation(api.npc.lobby.add, { code, required: true });
    await sam.mutation(api.games.start, { code });
    const board = await sam.query(api.board.get, { code });
    const gameId = board.game._id;
    const npc = board.players[1];
    const stockKey = board.stocks.find((stock) => stock.display)!.key;

    const { insightId, observation } = await t.run(async (context) =>
    {
        const hand = await context.db.query("playerInsights").withIndex("by_player_period", (q) =>
            q.eq("playerId", npc._id)).collect();
        for (const card of hand)
        {
            await context.db.delete(card._id);
        }

        await context.db.patch(gameId, { currentPeriod: 1, ...(legacy && { periodCount: 47 }) });
        await context.db.insert("playerInsights", { gameId, playerId: npc._id, period: legacy ? 0 : 1,
            stockKey, description: "Forecast", catalogCardId: "forecast", value: legacy ? 12 : 1,
            forecast: { from: legacy ? 0 : 1, to: legacy ? 12 : 2 }, resolved: false });
        const insightId = await context.db.insert("playerInsights", { gameId, playerId: npc._id, period: 1,
            stockKey: chanceStockKey, chanceKind: "loan", description: "Government Loan Stock", value: 0, resolved: false });

        const observation = await buildNpcObservation(context,
            (await context.db.get(gameId))!, (await context.db.get(npc._id))!);

        return { insightId, observation };
    });

    expect(observation.ownInsights).toEqual([{ id: "forecast", stockKey, value: 1 }]);
    expect(observation.chanceOffers).toEqual([{ action: { kind: "government-loan", insightId }, amount: 100_000 }]);
});
