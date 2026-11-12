import { describe, expect, it } from "vitest";
import { insightCatalog } from "../../stockmarket-shared/src/catalog";
import { api } from "../convex/_generated/api";
import { chooseTechStart, techPrices } from "../../stockmarket-shared/src/engine/techMarket";
import { techDefaultPeriods } from "../shared/packs";
import { roundPrices, roundPriceSteps } from "../shared/settlement";
import { setup, skipDealtSuspensions } from "./game-setup";
import { buildNpcObservation } from "../convex/npc/observation";
import { estimate } from "../../stockmarket-shared/src/packages/npc-engine/src/estimate";

const code = "test";

describe("stock packs", () =>
{
    it("updates existing seats and restores their original market and game length when switching back", async () =>
    {
        const { t, sam, bob } = await setup(8);
        const classic = await sam.query(api.board.get, { code });

        await expect(bob.mutation(api.games.setPack, { code, pack: "tech" })).rejects.toThrow("Only the lobby host");
        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        const tech = await bob.query(api.board.get, { code });

        expect(tech.game.periodCount).toBe(11);
        expect(tech.game.prices.every((price) => price.value === 0)).toBe(true);
        await expect(sam.mutation(api.games.setLength, { code, periodCount: 2 })).rejects.toThrow("Invalid game length");
        await expect(sam.mutation(api.games.setLength, { code, periodCount: 18 })).rejects.toThrow("Invalid game length");
        await sam.mutation(api.games.setLength, { code, periodCount: 17 });
        expect((await sam.query(api.board.get, { code })).game.periodCount).toBe(17);
        expect(tech.stocks.filter((stock) => stock.display).map((stock) => stock.name))
            .toEqual(["Apple", "ASML", "Netflix", "Facebook", "Alibaba", "Nvidia"]);
        expect(tech.players.every((player) => player.cash === 3_000_000 && player.holdings.length === 6)).toBe(true);
        expect((await t.query(api.tv.board, { code }))?.game.pack).toBe("tech");
        await sam.mutation(api.games.setPack, { code, pack: "classic" });
        const restored = await bob.query(api.board.get, { code });

        expect(restored.game.periodCount).toBe(8);
        expect(restored.game.prices).toEqual(classic.game.prices);
        expect(restored.players.map((player) => [player.cash, player.holdings]))
            .toEqual(classic.players.map((player) => [player.cash, player.holdings]));

        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        expect((await sam.query(api.board.get, { code })).game.periodCount).toBe(17);
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

        expect(playing.game.periodCount).toBe(3);
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
        expect(franticStocks.map((stock) => stock.key)).toEqual([8, 9, 10, 11, 7, 12]);
        expect(tvStocks?.map((stock) => stock.key)).toEqual(franticStocks.map((stock) => stock.key));
        expect(franticStocks.at(-2)?.variation).toBe(franticStocks.at(-1)?.variation);
        const allDealt = boards.flatMap((board) => board.insights);
        const catalog = (await t.run((context) => context.db.query("gameCatalogs").first()))!.cards;
        const extra = (card: { id?: string; catalogCardId?: string }) =>
            (card.id ?? card.catalogCardId)?.startsWith("frantic:downside:") ?? false;

        expect(boards.every((board) => board.insights.filter((card) => !extra(card)).length === 12
          && board.insights.filter((card) => card.chanceKind).length >= 2
          && board.insights.filter((card) => extra(card)).length > 12)).toBe(true);
        expect(new Set(allDealt.map((card) => card.catalogCardId)).size).toBe(allDealt.length);
        expect(allDealt.filter((card) => extra(card)).every((card) => card.value < 0)).toBe(true);

        for (const stock of franticStocks)
        {
            const cards = catalog.filter((card) => card.stockKey === stock.key);
            const positives = cards.filter((card) => card.value > 0).map((card) => card.value);
            const negatives = cards.filter((card) => card.value < 0).map((card) => card.value);
            const classic = insightCatalog.filter((card) => card.stockKey === stock.key && card.value < 0);
            const positiveSource = stock.key === 7 ? 12 : stock.key;
            const oldFrantic = insightCatalog.filter((card) => card.stockKey === positiveSource && card.value > 0)
                .map((card) => Math.round(card.value * 1.45 ** stock.variation * 100) / 100);
            const gain = positives.reduce((sum, value) => sum + value, 0);
            const loss = -negatives.reduce((sum, value) => sum + value, 0);

            expect(positives).toEqual(oldFrantic.map((value) => Math.round(value * 200) / 100));
            expect(negatives.every((value) => classic.some((card) => card.value * 2 === value))).toBe(true);
            expect(loss / gain).toBeGreaterThanOrEqual(0.475);
            expect(loss / gain).toBeLessThan(0.5);
        }

        await expect(sam.mutation(api.games.setPack, { code, pack: "classic" })).rejects.toThrow("lobby host");
    });

    it("reveals all Tech forecasts after three turns each and settles twelve two-month blocks", async () =>
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
        expect(windows.every((hand) => [...hand].every((caption) => /20\d{2}$/.test(caption)))).toBe(true);
        expect(boards[0].game.tradingDates?.boundaries).toHaveLength(techDefaultPeriods + 1);

        const gameId = boards[0].game._id;
        const start = (await t.run((context) => context.db.get(gameId)))!.techStart!;

        expect(techPrices(chooseTechStart(0.999_999, 18), 18)).toHaveLength(6);
        expect((await t.query(api.tv.board, { code: tvCode }))?.reveal).toBeNull();

        for (let expectedPeriod = 0; expectedPeriod < techDefaultPeriods; expectedPeriod++)
        {
            if (expectedPeriod === 0)
            {
                const clientsBySeat = new Map(boards.map((board, index) => [board.player._id, clients[index]]));
                for (let expectedTurn = 0; expectedTurn < clients.length * 3; expectedTurn++)
                {
                    const live = await t.query(api.tv.board, { code: tvCode });

                    expect(live?.reveal).toBeNull();
                    await clientsBySeat.get(live!.game.currentPlayerId!)!.mutation(api.trading.play,
                        { code: tvCode, expectedPeriod, expectedTurn });
                }

                const reveal = (await t.query(api.tv.board, { code: tvCode }))?.reveal;
                const phone = await sam.query(api.board.get, { code: tvCode });
                const forecasts = reveal!.insights.filter((card) => card.forecast);
                const ranges = new Set(forecasts.map((card) => `${card.forecast!.from}-${card.forecast!.to}`));
                const closing = techPrices(start, 1);

                expect(phone.game.status).toBe("closed");
                expect(forecasts.map((card) => card._id).toSorted()).toEqual(boards.flatMap((board) =>
                    board.insights.filter((card) => card.forecast).map((card) => card._id)).toSorted());

                for (const range of ["0-3", "3-6", "6-9", "9-12"])
                {
                    expect(ranges.has(range)).toBe(true);
                }

                expect(reveal!.insights.map((card) => card._id)).toEqual(phone.insights.map((card) => card._id));
                expect(reveal!.insights.filter((card) => card.marketSteps).every((card) => /20\d{2}$/.test(card.description)))
                    .toBe(true);
                expect(roundPrices(reveal!.prices, forecasts, reveal!.stocks, [])).toEqual(reveal!.prices);
                expect(roundPrices(reveal!.prices, reveal!.insights, reveal!.stocks, [])).toEqual(closing);
                const steps = roundPriceSteps(reveal!.prices, reveal!.insights, reveal!.stocks, []);
                for (const { stockKey, values, count } of steps)
                {
                    expect(count).toBeGreaterThan(30);
                    expect(values).toHaveLength(count);
                    expect(values.at(-1)).toBe(closing.find((item) => item.stockKey === stockKey)!.value);
                }

                expect(reveal!.insights.filter((card) => card.stockKey === -1)).toHaveLength(4);
            }
            else
            {
                await t.run((context) => context.db.patch(gameId, { status: "closed" }));
            }

            await skipDealtSuspensions(sam, tvCode);
            await t.mutation(api.tv.next, { code: tvCode, token, expectedPeriod });
            const game = await t.run((context) => context.db.get(gameId));

            expect(game?.prices).toEqual(techPrices(start, expectedPeriod + 1));

            if (expectedPeriod === 0)
            {
                const next = await sam.query(api.board.get, { code: tvCode });

                expect(next.game.currentPeriod).toBe(1);
                expect(next.game.tradingDates?.from).toBe(boards[0].game.tradingDates?.to);
                expect(next.insights.filter((card) => card.forecast)
                    .every((card) => card.period === 1 && card.forecast!.from >= 12)).toBe(true);
            }
        }

        const result = await sam.query(api.board.get, { code: tvCode });
        const allForecasts = await t.run((context) => context.db.query("playerInsights")
            .withIndex("by_game_period", (q) => q.eq("gameId", gameId)).collect());

        expect(result.game.status).toBe("finished");
        expect(result.game.priceHistory).toHaveLength(13);
        expect(allForecasts.filter((card) => card.forecast)).toHaveLength(12 * 4 * 12);
        expect(allForecasts.filter((card) => card.chanceKind)).toHaveLength(12 * 4);
    });

    it("starts all Tech seats with equal cash and gives NPCs only their own forecasts", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        await sam.mutation(api.npc.lobby.add, { code, required: true });
        const lobby = await sam.query(api.board.get, { code });

        expect(lobby.players.every((seat) => seat.cash === 3_000_000)).toBe(true);
        await t.run(async (context) =>
        {
            await context.db.patch(lobby.player._id, { cash: 60_000 });
            await context.db.patch(lobby.players[1]._id, { cash: 1_000_000 });
        });
        await sam.mutation(api.games.start, { code });
        const { game, players: opened } = await sam.query(api.board.get, { code });
        const observation = await t.run(async (context) =>
        {
            const current = (await context.db.get(game._id))!;
            const players = await context.db.query("players").collect();
            const npc = players.find((player) => player.gameId === current._id && player.controller?.kind === "npc")!;

            return buildNpcObservation(context, current, npc);
        });

        expect(opened.every((seat) => seat.cash === 3_000_000)).toBe(true);
        expect(observation.catalog.every((card) => card.stockKey < 0)).toBe(true);
        expect(estimate(observation, true, "tech").map(({ stockKey }) => stockKey)).toEqual([106, 101, 102, 103, 104, 105]);
    });
});
