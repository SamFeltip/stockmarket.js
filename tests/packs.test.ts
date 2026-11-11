import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chooseTechStart, techPrices } from "../../stockmarket-shared/src/engine/techMarket";
import { packRounds, techDefaultPeriods } from "../shared/packs";
import { setup, skipDealtSuspensions } from "./game-setup";
import { buildNpcObservation } from "../convex/npc/observation";
import { estimate } from "../../stockmarket-shared/src/packages/npc-engine/src/estimate";

const code = "test";
const techRoundCount = packRounds("tech", techDefaultPeriods);

describe("stock packs", () =>
{
    it("updates existing seats and restores their original market and game length when switching back", async () =>
    {
        const { t, sam, bob } = await setup(8);
        const classic = await sam.query(api.board.get, { code });

        await expect(bob.mutation(api.games.setPack, { code, pack: "tech" })).rejects.toThrow("Only the lobby host");
        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        const tech = await bob.query(api.board.get, { code });

        expect(tech.game.periodCount).toBe(143);
        expect(tech.game.prices.every((price) => price.value === 0)).toBe(true);
        await expect(sam.mutation(api.games.setLength, { code, periodCount: 2 })).rejects.toThrow("Invalid game length");
        await expect(sam.mutation(api.games.setLength, { code, periodCount: 18 })).rejects.toThrow("Invalid game length");
        await sam.mutation(api.games.setLength, { code, periodCount: 17 });
        expect((await sam.query(api.board.get, { code })).game.periodCount).toBe(215);
        expect(tech.stocks.filter((stock) => stock.display).map((stock) => stock.name)).toEqual(["ASML", "Facebook", "Nvidia", "Alibaba", "Apple", "Netflix"]);
        expect(tech.players.every((player) => player.cash === 3_000_000 && player.holdings.length === 6)).toBe(true);
        expect((await t.query(api.tv.board, { code }))?.game.pack).toBe("tech");
        await sam.mutation(api.games.setPack, { code, pack: "classic" });
        const restored = await bob.query(api.board.get, { code });

        expect(restored.game.periodCount).toBe(8);
        expect(restored.game.prices).toEqual(classic.game.prices);
        expect(restored.players.map((player) => [player.cash, player.holdings]))
            .toEqual(classic.players.map((player) => [player.cash, player.holdings]));

        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        expect((await sam.query(api.board.get, { code })).game.periodCount).toBe(215);
    });

    it("launches a four-period Tech game with a new eight-month market", async () =>
    {
        const { t, sam, clients } = await setup();
        const shortCode = "eight-months";

        await sam.mutation(api.games.create, { code: shortCode, pack: "tech", periodCount: 3 });

        for (const client of clients.slice(1))
        {
            await client.mutation(api.games.join, { code: shortCode });
        }

        const waiting = await sam.query(api.board.get, { code: shortCode });

        expect((await t.run((context) => context.db.get(waiting.game._id)))?.techStart).toBeUndefined();
        await sam.mutation(api.games.start, { code: shortCode });
        const playing = await sam.query(api.board.get, { code: shortCode });
        const game = await t.run((context) => context.db.get(playing.game._id));

        expect(playing.game.periodCount).toBe(47);
        expect(game?.techStart).toBeTypeOf("number");
        expect(game?.prices).toEqual(techPrices(game!.techStart!, 0));
        expect(game?.priceHistory).toEqual([{ period: 0, prices: game?.prices }]);
        expect(playing.insights.filter((card) => card.forecast)).toHaveLength(12);
        expect(playing.insights.filter((card) => card.chanceKind)).toHaveLength(1);
        expect(playing.insights.filter((card) => card.stockKey === -1)).toHaveLength(1);
    });

    it("deals every Frantic player extra chance cards and equalizes Trusthouse and Natwest volatility", async () =>
    {
        const { t, sam, clients } = await setup();
        const classic = await sam.query(api.board.get, { code });

        await sam.mutation(api.games.setPack, { code, pack: "frantic" });
        await sam.mutation(api.games.start, { code });
        const boards = await Promise.all(clients.map((client) => client.query(api.board.get, { code })));

        const franticStocks = boards[0].stocks.filter((stock) => stock.display);
        const tvStocks = (await t.query(api.tv.board, { code }))?.stocks;

        expect(boards[0].game.prices).toEqual(classic.game.prices.map((price) =>
            ({ ...price, value: price.value * 3 })));
        expect(franticStocks.map((stock) => stock.key)).toEqual(classic.stocks.filter((stock) =>
            stock.display).map((stock) => stock.key));
        expect(tvStocks?.map((stock) => stock.key)).toEqual(franticStocks.map((stock) => stock.key));
        expect(franticStocks[0].variation).toBe(franticStocks.at(-1)?.variation);
        expect(boards.every((board) => board.insights.length === 12
          && board.insights.filter((card) => card.chanceKind).length >= 2)).toBe(true);
        const catalog = await t.run((context) => context.db.query("gameCatalogs").first());
        const values = (key: number) => catalog!.cards.filter((card) => card.stockKey === key)
            .map((card) => card.value).toSorted((a, b) => a - b);

        expect(values(7)).toEqual(values(12));
        expect(Math.max(...values(12))).toBeGreaterThan(20);
        await expect(sam.mutation(api.games.setPack, { code, pack: "classic" })).rejects.toThrow("lobby host");
    });

    it("rejects a Frantic catalog that cannot cover the base hands and reserved chance cards", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.setPack, { code, pack: "frantic" });
        await t.run(async (context) =>
        {
            const cards = await context.db.query("insights").collect();
            const retained = new Set(cards.filter((card) => card.stockKey !== 7 && card.stockKey !== 12)
                .slice(0, 12).map((card) => card._id));
            for (const card of cards)
            {
                if (!retained.has(card._id))
                {
                    await context.db.delete(card._id);
                }
            }
        });

        await expect(sam.mutation(api.games.start, { code })).rejects.toThrow("Not enough insights for all players");
        const board = await sam.query(api.board.get, { code });

        expect(board.game.status).toBe("waiting");
        expect(board.insights).toEqual([]);
    });

    it("deals exclusive Tech windows and settles all 144 rounds to cached historical prices", async () =>
    {
        const { t, sam, clients } = await setup();
        const token = "b".repeat(64);
        const tvCode = "tech-tv";

        await t.mutation(api.tv.create, { code: tvCode, periodCount: 5, token });
        await expect(t.mutation(api.tv.setPack, { code: tvCode, token: "a".repeat(64), pack: "tech" }))
            .rejects.toThrow("controlling TV");
        await t.mutation(api.tv.setPack, { code: tvCode, token, pack: "tech" });

        for (const client of clients)
        {
            await client.mutation(api.games.join, { code: tvCode });
        }

        await t.mutation(api.tv.start, { code: tvCode, token });

        const boards = await Promise.all(clients.map((client) => client.query(api.board.get, { code: tvCode })));

        expect(boards.every((board) => board.insights.length === 14
          && board.insights.every((card) => card.playerId === board.player._id))).toBe(true);
        const windows = boards.map((board) => new Set(board.insights.filter((card) => card.forecast)
            .map((card) => card.description)));

        expect(windows.every((hand) => hand.size === 2)).toBe(true);
        expect(new Set(windows.flatMap((hand) => [...hand])).size).toBe(clients.length * 2);

        const gameId = boards[0].game._id;
        const start = (await t.run((context) => context.db.get(gameId)))!.techStart!;

        expect(techPrices(chooseTechStart(0.999_999, 18), packRounds("tech", 18))).toHaveLength(6);

        for (let expectedPeriod = 0; expectedPeriod < techRoundCount; expectedPeriod++)
        {
            await t.run((context) => context.db.patch(gameId, { status: "closed" }));

            if (expectedPeriod === 0)
            {
                const reveal = (await t.query(api.tv.board, { code: tvCode }))?.reveal;

                const phone = await sam.query(api.board.get, { code: tvCode });
                for (const { stockKey, value } of techPrices(start, 1))
                {
                    const cards = reveal!.insights.filter((card) => card.stockKey === stockKey);
                    const opening = reveal!.prices.find((price) => price.stockKey === stockKey)!.value;

                    expect(cards.length).toBeGreaterThan(1);
                    expect(cards.every((card) => card.description.startsWith("Historical close · "))).toBe(true);
                    expect(new Set(cards.map((card) => card._id)).size).toBe(cards.length);
                    expect(phone.insights.filter((card) => card.stockKey === stockKey).map((card) => card._id))
                        .toEqual(cards.map((card) => card._id));
                    expect(opening + cards.reduce((sum, card) => sum + card.value, 0)).toBeCloseTo(value, 2);
                }

                expect(reveal?.insights.filter((card) => card.stockKey === -1)).toHaveLength(4);
                expect(reveal?.insights.some((card) => card.description.includes(" – "))).toBe(false);
            }

            await skipDealtSuspensions(sam, tvCode);
            await t.mutation(api.tv.next, { code: tvCode, token, expectedPeriod });
            const game = await t.run((context) => context.db.get(gameId));

            expect(game?.prices).toEqual(techPrices(start, expectedPeriod + 1));
        }

        const result = await sam.query(api.board.get, { code: tvCode });
        const allForecasts = await t.run((context) => context.db.query("playerInsights")
            .withIndex("by_game_period", (q) => q.eq("gameId", gameId)).collect());

        expect(result.game.status).toBe("finished");
        expect(result.game.priceHistory).toHaveLength(145);
        expect(allForecasts.filter((card) => card.forecast)).toHaveLength(12 * 4 * 12);
        expect(allForecasts.filter((card) => card.chanceKind)).toHaveLength(144 * 4);
    });

    it("lets a hard NPC use its own forecasts without sampling opponents' historical cards", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        await sam.mutation(api.npc.lobby.add, { code, required: true });
        await sam.mutation(api.games.start, { code });
        const { game } = await sam.query(api.board.get, { code });
        const observation = await t.run(async (context) =>
        {
            const current = (await context.db.get(game._id))!;
            const players = await context.db.query("players").collect();
            const npc = players.find((player) => player.gameId === current._id && player.controller?.kind === "npc")!;

            return buildNpcObservation(context, current, npc);
        });

        expect(observation.catalog.every((card) => card.stockKey < 0)).toBe(true);
        expect(estimate(observation, true, "tech").map(({ stockKey }) => stockKey)).toEqual([106, 101, 102, 103, 104, 105]);
    });

    it("shows the Crashing shock in the reveal and settles it while honoring a suspended stock", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.setPack, { code, pack: "crashing" });
        await sam.mutation(api.games.start, { code });
        const { game } = await sam.query(api.board.get, { code });
        const protectedStock = game.prices[0].stockKey;

        await t.run((context) => context.db.patch(game._id, {
            currentPeriod: 2, status: "closed", suspended: [protectedStock],
        }));
        const board = await t.query(api.tv.board, { code });

        expect(board?.reveal?.insights).toHaveLength(6);
        expect(board?.reveal?.insights.every((card) => card.description.includes("Market crash"))).toBe(true);
        await sam.mutation(api.rounds.next, { code, expectedPeriod: 2 });
        const after = await sam.query(api.board.get, { code });

        expect(after.game.prices).toEqual(game.prices.map((price) => price.stockKey === protectedStock ? price
            : { ...price, value: Math.round(price.value * 70) / 100 }));
    });
});
