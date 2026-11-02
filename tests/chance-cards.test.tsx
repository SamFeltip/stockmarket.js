import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../convex/_generated/api";
import { insightCatalog } from "../convex/catalog";
import { cashStockKey, chanceCards, chanceStockKey, privateCashPercent, specialDeck } from "../shared/chance-cards";
import { roundCash } from "../shared/settlement";
import { PlayerDock } from "../src/PlayerDock";
import { previewRound } from "../src/round-preview";
import { setup } from "./game-setup";

describe("board-game special cards", () =>
{
    it("builds the exact 110-card multiset, with four ±10% cash cards and two of each chance", () =>
    {
        const special = specialDeck();

        expect(insightCatalog).toHaveLength(92);
        expect(insightCatalog.length + special.length).toBe(110);
        expect(new Set(special.map((card) => card.id)).size).toBe(18);
        expect(special.filter((card) => card.stockKey === cashStockKey).map((card) => card.value).toSorted())
            .toEqual([-0.1, -0.1, -0.1, -0.1, 0.1, 0.1, 0.1, 0.1]);

        for (const card of chanceCards)
        {
            expect(special.filter((item) => item.chanceKind === card.kind)).toHaveLength(2);
        }
    });

    it("deals ten cards per seat from a pinned shared deck without replacement and redeals each round", async () =>
    {
        const { t, sam, bob, clients } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const first = await sam.query(api.board.get, { code: "test" });
        const catalog = await t.run(async (context) => await context.db.query("gameCatalogs").first());

        expect(catalog?.cards).toHaveLength(110);
        expect(catalog?.cards.filter((card) => card.chanceKind)).toHaveLength(10);
        expect(catalog?.cards.filter((card) => card.stockKey === cashStockKey)).toHaveLength(8);
        const deck = new Map(catalog!.cards.map((card) => [card.id, card]));
        for (let period = 0; period < 2; period++)
        {
            const hands = await Promise.all(clients.map(async (client) => await client.query(api.board.get, { code: "test" })));
            const dealt = hands.flatMap((board) => board.insights);

            expect(dealt).toHaveLength(40);
            expect(new Set(dealt.map((card) => card.catalogCardId)).size).toBe(40);

            for (const board of hands)
            {
                expect(board.insights).toHaveLength(10);
                expect(board.insights.every((card) => card.playerId === board.player._id
                  && card.period === period)).toBe(true);

                for (const card of board.insights)
                {
                    expect(card).toMatchObject({ stockKey: deck.get(card.catalogCardId!)!.stockKey,
                        value: deck.get(card.catalogCardId!)!.value });
                    expect(card.chanceKind).toBe(deck.get(card.catalogCardId!)!.chanceKind);
                }
            }

            for (let turn = 0; turn < 12; turn++)
            {
                await clients[(period + turn) % clients.length].mutation(api.trading.play, { code: "test", expectedPeriod: period, expectedTurn: turn });
            }

            await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: period });
        }

        const next = await bob.query(api.board.get, { code: "test" });

        expect(next.game.currentPeriod).toBe(2);
        expect(next.insights).toHaveLength(10);
        expect(next.insights.some((card) => first.insights.some((old) => old._id === card._id))).toBe(false);
    });

    it("keeps cash/chance hands private, shows only granted cards and disables activation", async () =>
    {
        const { t, sam, bob } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const initial = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            for (const card of await context.db.query("playerInsights").collect())
            {
                await context.db.delete(card._id);
            }

            for (const card of specialDeck().filter((item) => item.chanceKind === "loan").slice(0, 1))
            {
                await context.db.insert("playerInsights", { gameId: initial.game._id, playerId: initial.player._id, period: 0,
                    stockKey: card.stockKey, value: card.value, description: card.description,
                    chanceKind: card.chanceKind, resolved: false });
            }
        });
        const own = await sam.query(api.board.get, { code: "test" });
        const opponent = await bob.query(api.board.get, { code: "test" });
        const html = renderToStaticMarkup(<PlayerDock board={own} />);

        expect(opponent.insights).toHaveLength(0);
        expect(html).toContain("Government Loan Stock");
        expect(html).not.toContain("Rights Issue");
        expect(html).toContain("disabled=\"\">Activate");
        expect(html).toContain("trade-dialog");
        expect(html).toContain("Drag down to close trade drawer");
        expect(html).toContain("text-secondary");
        expect(html).toContain("+0%");
        expect(renderToStaticMarkup(<PlayerDock board={opponent} />)).toContain("No Chance Cards");
    });

    it("totals only a player's private cash cards, including cancellation to zero", () =>
    {
        const own = { playerId: "a", stockKey: cashStockKey, value: 0.1 };
        const other = { ...own, playerId: "b" };

        expect(privateCashPercent([], "a")).toBe(0);
        expect(privateCashPercent([own, own, own, other, { ...own, stockKey: 8 }], "a")).toBe(30);
        expect(privateCashPercent([own, { ...own, value: -0.1 }], "a")).toBe(0);
        expect(privateCashPercent([{ ...own, value: -0.1 }], "a")).toBe(-10);
    });

    it("settles the shared cash movement for every player, rounding the adjustment symmetrically to £1,000", () =>
    {
        const card = { playerId: "a", stockKey: cashStockKey, value: 0.1 };

        expect(roundCash({ _id: "a", cash: 65_500 }, [card], [])).toBe(72_500);
        expect(roundCash({ _id: "b", cash: 25_000 }, [card], [])).toBe(28_000);
        expect(roundCash({ _id: "b", cash: 25_000 }, [{ ...card, value: -0.1 }], [])).toBe(22_000);
        expect(roundCash({ _id: "a", cash: 65_500 }, [card, { ...card, value: -0.1 }], [])).toBe(65_500);
        expect(roundCash({ _id: "a", cash: 4000 }, [{ ...card, value: -2 }], [])).toBe(0);
    });

    it("settles cash exactly once and matches the round preview without blocking on disabled chance cards", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const initial = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            for (const card of await context.db.query("playerInsights").collect())
            {
                await context.db.delete(card._id);
            }

            await context.db.patch(initial.game._id, { status: "closed" });
            await context.db.patch(initial.player._id, { cash: 65_500 });
            await context.db.insert("playerInsights", { gameId: initial.game._id, playerId: initial.player._id,
                period: 0, stockKey: cashStockKey, value: 0.1, description: "Cash +10%", resolved: false });
            await context.db.insert("playerInsights", { gameId: initial.game._id, playerId: initial.player._id,
                period: 0, stockKey: chanceStockKey, chanceKind: "hold", value: 0, description: "Share Suspended", resolved: false });
        });
        const closed = await sam.query(api.board.get, { code: "test" });
        const preview = previewRound(closed, closed.insights, closed.stocks.map((stock) => stock.key));
        const hold = closed.insights.find((card) => card.chanceKind === "hold")!;

        await expect(sam.mutation(api.rounds.hold, { code: "test", insightId: hold._id, stockKey: 8 }))
            .rejects.toThrow("not a hold-stock insight");

        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const next = await sam.query(api.board.get, { code: "test" });

        expect(next.player.cash).toBe(72_500);
        expect(next.players.map((player) => player.cash)).toEqual(preview.players.map((player) => player.cash));
        expect(next.game.prices).toEqual(closed.game.prices);
        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow();
        expect((await sam.query(api.board.get, { code: "test" })).player.cash).toBe(72_500);
    });
});
