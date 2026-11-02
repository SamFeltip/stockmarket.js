import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import { PlayAnimation } from "../src/PlayAnimation";
import { DebentureModal } from "../src/DebentureModal";
import { PlayerDock } from "../src/PlayerDock";
import { bankruptGame } from "./debenture-setup";

const client = new ConvexReactClient("https://debenture-test.invalid");

it("retains unused debentures privately across deals and removes their physical copies from the fresh deck", async () =>
{
    const { t, sam, bob, board, insightId, physicalCard } = await bankruptGame();
    const retained = board.insights.find((card) => card._id === insightId)!;

    expect(retained.period).toBe(0);
    expect(board.game.currentPeriod).toBe(1);
    const fresh = await t.run(async (context) => await context.db.query("playerInsights")
        .withIndex("by_game_period", (q) => q.eq("gameId", board.game._id).eq("period", 1)).collect());

    expect(fresh).toHaveLength(40);
    expect(fresh.some((card) => card.catalogCardId === physicalCard.id)).toBe(false);
    const opponent = await bob.query(api.board.get, { code: "test" });

    expect(opponent.insights.some((card) => card._id === insightId)).toBe(false);
    const html = renderToStaticMarkup(<ConvexProvider client={client}><PlayerDock board={board} /></ConvexProvider>);

    expect(html).toContain(`data-bs-target="#chance-card-${insightId}"`);
    expect(html).toContain("Keep this card between rounds");
    expect(html).toContain("20,000 stocks");
    expect(html).toContain("£2.50 each");
    expect(html).toContain("role=\"radiogroup\"");
    expect(html).toContain("type=\"radio\"");
    expect(html).toContain("Cancel");
    expect(html).toContain("Sell");
    expect((await sam.query(api.board.get, { code: "test" })).debentureOffers)
        .toContainEqual({ stockKey: 8, quantity: 20_000, amount: 50_000, unitPrice: 2.5,
            claimUntilPeriod: 2, unavailableReason: null });
});

it("sells only the chosen bankrupt holding at its purchase cost, consumes the card and one turn, and broadcasts the payout", async () =>
{
    const { t, sam, board, insightId, command } = await bankruptGame();

    await sam.mutation(api.trading.redeemDebenture, command);
    const after = await sam.query(api.board.get, { code: "test" });
    const publicBoard = (await sam.query(api.tv.board, { code: "test" }))!;

    expect(after.player.cash).toBe(board.player.cash + 50_000);
    expect(after.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(0);
    expect(after.player.holdings.filter((holding) => holding.stockKey !== 8))
        .toEqual(board.player.holdings.filter((holding) => holding.stockKey !== 8));
    expect(after.game.turn).toBe(1);
    expect(after.game.currentPlayerId).toBe(after.players[1]._id);
    expect((await t.run(async (context) => await context.db.get(insightId)))?.used).toBe(true);
    expect(after.feed[0]).toMatchObject({ stockKey: 8, quantity: -20_000, debenturePayout: 50_000 });
    expect(publicBoard.feed[0].debenturePayout).toBe(50_000);
    const popup = renderToStaticMarkup(<PlayAnimation board={{ ...after, feed: [after.feed[0]] }} preview />);

    expect(popup).toContain("Debenture sold at £50,000");
    expect(popup).toContain("-20,000");
    expect(popup).toContain(board.stocks.find((stock) => stock.key === 8)!.imagePath);
    await t.run(async (context) => await context.db.patch(board.game._id,
        { turn: 4, currentPlayerId: board.player._id, currentUserId: board.user._id }));
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedTurn: 4 }))
        .rejects.toThrow("cannot be used");
    expect((await sam.query(api.board.get, { code: "test" })).player.cash).toBe(after.player.cash);
});

it("allows the second claim round, rejects expired or recovered stocks, and refuses to invent missing purchase costs", async () =>
{
    const { t, sam, board, command } = await bankruptGame();

    await t.run(async (context) => await context.db.patch(board.game._id, { currentPeriod: 3 }));
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedPeriod: 3 }))
        .rejects.toThrow("claim window has ended");
    const expired = await sam.query(api.board.get, { code: "test" });

    expect(expired.debentureOffers.find((offer) => offer.stockKey === 8)?.unavailableReason).toContain("ended");
    await t.run(async (context) => await context.db.patch(board.game._id, { currentPeriod: 2,
        prices: board.game.prices.map((price) => price.stockKey === 8 ? { ...price, value: 1 } : price) }));
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedPeriod: 2 }))
        .rejects.toThrow("bankrupt stock");
    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { prices: board.game.prices });

        for (const action of await context.db.query("gameActions").collect())
        {
            await context.db.delete(action._id);
        }
    });
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedPeriod: 2 }))
        .rejects.toThrow("purchase cost");
    const unknown = await sam.query(api.board.get, { code: "test" });

    expect(unknown.debentureOffers.find((offer) => offer.stockKey === 8)?.amount).toBeNull();
    // A known purchase price can be recovered from the original period's chart for older actions.
    await t.run(async (context) => await context.db.insert("gameActions", { gameId: board.game._id,
        actorPlayerId: board.player._id, period: 0, turn: 0, action: { kind: "buy", stockKey: 8, quantity: 20_000 } }));
    await sam.mutation(api.trading.redeemDebenture, { ...command, expectedPeriod: 2 });
    expect((await sam.query(api.board.get, { code: "test" })).player.cash).toBe(board.player.cash + 50_000);
});

it("rejects foreign cards, stale commands, wrong powers, future cards and claims outside your turn", async () =>
{
    const { t, sam, bob, outsider, board, insightId, command } = await bankruptGame();

    await expect(outsider.mutation(api.trading.redeemDebenture, command)).rejects.toThrow();
    await expect(bob.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("not your turn");
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedTurn: 1 })).rejects.toThrow("turn has changed");
    await expect(sam.mutation(api.trading.redeemDebenture, { ...command, expectedPeriod: 0 })).rejects.toThrow("turn has changed");
    await t.run(async (context) => await context.db.patch(insightId, { chanceKind: "loan" }));
    await expect(sam.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("cannot be used");
    await t.run(async (context) => await context.db.patch(insightId, { chanceKind: "debenture", period: 2 }));
    await expect(sam.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("cannot be used");
    await t.run(async (context) => await context.db.patch(insightId, { period: 0, playerId: board.players[1]._id }));
    await expect(sam.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("cannot be used");
    expect((await sam.query(api.board.get, { code: "test" })).player.cash).toBe(board.player.cash);
});

it("keeps the empty-state dialog useful and closes trading when a claim uses the last turn", async () =>
{
    const { t, sam, board, insightId, command } = await bankruptGame();
    const html = renderToStaticMarkup(
        <ConvexProvider client={client}>
            <DebentureModal board={{ ...board, debentureOffers: [] }} insightId={insightId} used={false} />
        </ConvexProvider>,
    );

    expect(html).toContain("You don’t own any bankrupt stocks right now");
    expect(html).toContain("Keep this card for a later round");
    const turn = board.players.length * 3 - 1;

    await t.run(async (context) => await context.db.patch(board.game._id, { turn }));
    await sam.mutation(api.trading.redeemDebenture, { ...command, expectedTurn: turn });
    expect((await sam.query(api.board.get, { code: "test" })).game.status).toBe("closed");
});
