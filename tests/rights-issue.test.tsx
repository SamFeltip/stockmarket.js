import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { RightsIssueModal } from "../src/RightsIssueModal";
import { renderToStaticMarkup } from "react-dom/server";
import { api, internal } from "../convex/_generated/api";
import { chanceStockKey } from "../shared/chance-cards";
import { rightsEntitlement, rightsPurchaseError } from "../shared/rights-issue";
import { RightsIssue } from "../src/RightsIssue";
import { setup } from "./game-setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture()
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

it("offers the retail one-for-two £1 purchase, in cyclic play order, without additional bargains", async () =>
{
    const { t, bob, sam, clients, board, insightId, command } = await fixture();

    await bob.mutation(api.rightsIssue.activate, command);
    const started = await bob.query(api.board.get, { code: "test" });
    const issue = started.game.rightsIssue!;
    const decide = (index: number, quantity: number) => ({ code: "test", insightId, expectedIndex: index, quantity });

    expect(issue.offers.map((offer) => offer.playerId))
        .toEqual([board.players[1]._id, board.players[3]._id, board.players[0]._id]);
    expect(issue.offers.map((offer) => offer.maximum)).toEqual([3000, 1000, 2000]);
    expect(started.insights.find((card) => card._id === insightId)).toMatchObject({ used: true, resolved: true });
    await bob.mutation(api.rightsIssue.decide, decide(0, 3000));
    const bought = await bob.query(api.board.get, { code: "test" });

    expect(bought.player.cash).toBe(7000);
    expect(bought.player.holdings).toEqual([{ stockKey: 8, quantity: 9001 }]);
    expect(bought.game).toMatchObject({ turn: 6, currentPeriod: 1, currentPlayerId: board.player._id });
    expect(bought.game.prices).toEqual(started.game.prices);
    await clients[3].mutation(api.rightsIssue.decide, decide(1, 0));
    await sam.mutation(api.rightsIssue.decide, decide(2, 2000));
    const completed = await sam.query(api.board.get, { code: "test" });

    expect(completed.game.rightsIssue?.completed).toBe(true);
    expect(completed.game.turn).toBe(6);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const finished = await sam.query(api.board.get, { code: "test" });

    expect(finished.game).toMatchObject({ turn: 7, currentPeriod: 1, currentPlayerId: board.players[2]._id });
    expect(finished.game.rightsIssue).toBeUndefined();
    const purchases = await t.run(async (context) => (await context.db.query("gameActions").collect())
        .filter((action) => action.rightsIssueId === insightId && action.action.kind === "buy"));

    expect(purchases).toHaveLength(2);
    expect(purchases.every((action) => action.unitPrice === 1 && action.turn === 6)).toBe(true);
    await expect(bob.mutation(api.rightsIssue.activate, { ...command, expectedTurn: 7 })).rejects.toThrow("not your turn");
});

it("rejects wrong owners, stale/replayed choices, overspending, excess entitlement and trades during the pause", async () =>
{
    const { t, sam, bob, outsider, board, insightId, command } = await fixture();

    await expect(sam.mutation(api.rightsIssue.activate, command)).rejects.toThrow("not your turn");
    await expect(outsider.mutation(api.rightsIssue.activate, command)).rejects.toThrow();
    await expect(bob.mutation(api.rightsIssue.activate, { ...command, expectedPeriod: 0 })).rejects.toThrow("turn has changed");
    await expect(bob.mutation(api.rightsIssue.activate, { ...command, stockKey: -1 })).rejects.toThrow("tradable stock");
    await t.run(async (context) => await context.db.patch(insightId, { playerId: board.players[0]._id }));
    await expect(bob.mutation(api.rightsIssue.activate, command)).rejects.toThrow("cannot be used");
    await t.run(async (context) => await context.db.patch(insightId, { playerId: board.player._id }));
    await bob.mutation(api.rightsIssue.activate, command);
    const choice = { code: "test", insightId, expectedIndex: 0, quantity: 3001 };
    const before = await bob.query(api.board.get, { code: "test" });

    await expect(bob.mutation(api.rightsIssue.decide, choice)).rejects.toThrow("one extra share");
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: -1 })).rejects.toThrow("whole number");
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 0.5 })).rejects.toThrow("whole number");
    await expect(sam.mutation(api.rightsIssue.decide, { ...choice, quantity: 1 })).rejects.toThrow("Wait for your");
    await expect(bob.mutation(api.trading.play, { code: "test", expectedPeriod: 1, expectedTurn: 6 }))
        .rejects.toThrow("Trading is paused");
    await expect(bob.mutation(api.trading.activateGovernmentLoan, {
        code: "test", expectedPeriod: 1, expectedTurn: 6, insightId,
    })).rejects.toThrow("Trading is paused");
    await expect(bob.mutation(api.trading.redeemDebenture, command)).rejects.toThrow("Trading is paused");
    expect(await bob.query(api.board.get, { code: "test" })).toEqual(before);
    await t.run(async (context) => await context.db.patch(board.player._id, { cash: 10 }));
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 1000 })).rejects.toThrow("enough cash");
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 1 })).rejects.toThrow("steps of 1,000");
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 500 })).rejects.toThrow("steps of 1,000");
    await bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 0 });
    await expect(bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 1 })).rejects.toThrow("decision has changed");
    const publicBoard = (await t.query(api.tv.board, { code: "test" }))!;

    expect(publicBoard.game.rightsIssue?.index).toBe(1);
    expect(publicBoard.reveal).toBeNull();
});

it("lets spectators skip only the current offer, closes the final bargain after choices, and ignores repeated completion", async () =>
{
    const { t, bob, sam, board, insightId, command } = await fixture();

    await t.run(async (context) => await context.db.patch(board.game._id, { turn: 11 }));
    await bob.mutation(api.rightsIssue.activate, { ...command, expectedTurn: 11 });

    for (let index = 0; index < 3; index++)
    {
        await t.mutation(api.rightsIssue.skip, { code: "test", insightId, expectedIndex: index });
        await expect(t.mutation(api.rightsIssue.skip, { code: "test", insightId, expectedIndex: index }))
            .rejects.toThrow("decision has changed");
    }

    expect((await sam.query(api.board.get, { code: "test" })).game.status).toBe("playing");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game).toMatchObject({ status: "closed", turn: 12, currentPeriod: 1 });
    await t.mutation(internal.rightsIssue.finish, { gameId: board.game._id, insightId });
    expect((await sam.query(api.board.get, { code: "test" })).game.turn).toBe(12);
});

it("automatically handles NPC shareholders, updates company roles and preserves the frozen entitlement", async () =>
{
    const { t, bob, board, command } = await fixture();

    await t.run(async (context) =>
    {
        await context.db.patch(board.players[3]._id, { controller: { kind: "npc", personality: "felix" } });
        await context.db.patch(board.player._id, { holdings: [{ stockKey: 8, quantity: 90_000 }] });
    });
    await bob.mutation(api.rightsIssue.activate, command);
    await bob.mutation(api.rightsIssue.decide, { code: "test", insightId: command.insightId, expectedIndex: 0, quantity: 10_000 });
    const after = await bob.query(api.board.get, { code: "test" });

    expect(after.game.rightsIssue?.index).toBe(2);
    expect(after.game.rightsIssue?.offers[0].maximum).toBe(45_000);
    expect(after.game.rightsIssue?.offers[1].purchased).toBe(1000);
    expect(after.players.find((player) => player._id === board.player._id)?.roles)
        .toContainEqual({ stockKey: 8, role: "chairman" });
    expect(after.feed.some((item) => item.roleAfter === "chairman")).toBe(true);
});

it("renders purchase, waiting and spectator variants using the shared trade controls and portfolios", async () =>
{
    const { bob, command } = await fixture();

    await bob.mutation(api.rightsIssue.activate, command);
    const board = await bob.query(api.board.get, { code: "test" });
    const own = renderToStaticMarkup(<RightsIssue board={board} playerId={board.player._id} />);
    const waiting = renderToStaticMarkup(<RightsIssue board={board} playerId={board.players[2]._id} />);
    const spectator = renderToStaticMarkup(<RightsIssue board={board} spectator />);

    expect(own).toContain("trade-inputs");
    expect(own).toContain("step=\"1000\"");
    expect(own).toContain("Rights Issue shareholders");
    expect(own).not.toContain("You may only buy one extra share");
    expect(own).not.toContain("You may buy one extra share");
    expect(own).toContain("Maximum: 3,000 shares");
    expect(own).toContain("Rights Issue price");
    expect(own).not.toContain("game-grid");
    expect(waiting).toContain("Rights Issue shareholders");
    expect(waiting).not.toContain("trade-inputs");
    expect(spectator).toContain("Player portfolios");
    expect(spectator).toContain("is-muted");
    expect(spectator).not.toContain("trade-inputs");
    expect(rightsEntitlement(6001)).toBe(3000);
    expect(rightsEntitlement(5000)).toBe(2000);
    expect(rightsEntitlement(1000)).toBe(0);
    expect(rightsPurchaseError(0, 0, 0)).toBe("");
    expect(rightsPurchaseError(Number.NaN, 1000, 1000)).toContain("whole number");
});

it("rounds the purchase maximum down to a full trading lot when cash is limited", async () =>
{
    const { bob, command } = await fixture();

    await bob.mutation(api.rightsIssue.activate, command);
    const board = await bob.query(api.board.get, { code: "test" });
    const current = board.players.find((player) => player._id === board.player._id)!;

    current.cash = 2999;
    expect(renderToStaticMarkup(<RightsIssue board={board} playerId={current._id} />))
        .toContain("Maximum: 2,000 shares");
    current.cash = 999;
    const html = renderToStaticMarkup(<RightsIssue board={board} playerId={current._id} />);

    expect(html).toContain("Maximum: 0 shares");
    expect(html).toContain("disabled=\"\">Buy</button>");
});

it("preserves bank inventory and does not spend an invalid offer or create shares beyond available stock", async () =>
{
    const { t, bob, board, command } = await fixture();

    await t.run(async (context) => await context.db.patch(board.player._id, {
        holdings: [{ stockKey: 8, quantity: 192_001 }],
    }));
    await bob.mutation(api.rightsIssue.activate, command);
    const choice = { code: "test", insightId: command.insightId, expectedIndex: 0, quantity: 2000 };

    await expect(bob.mutation(api.rightsIssue.decide, choice)).rejects.toThrow("enough shares available");
    expect((await bob.query(api.board.get, { code: "test" })).game.rightsIssue?.index).toBe(0);
    await bob.mutation(api.rightsIssue.decide, { ...choice, quantity: 1000 });
    const after = await bob.query(api.board.get, { code: "test" });

    expect(after.players.reduce((sum, player) => sum + (player.holdings.find((holding) =>
        holding.stockKey === 8)?.quantity ?? 0), 0)).toBe(199_001);
});

it("offers only companies with shareholders in the shared selector, including bankrupt companies", async () =>
{
    const { t, bob, board, command } = await fixture();

    await t.run(async (context) => await context.db.patch(board.game._id, {
        prices: board.game.prices.map((price) => ({ ...price, value: 0 })),
    }));
    const current = await bob.query(api.board.get, { code: "test" });
    const client = new ConvexReactClient("https://rights-selector-test.invalid");
    const html = renderToStaticMarkup(
        <ConvexProvider client={client}>
            <RightsIssueModal board={current} insightId={command.insightId} used={false} />
        </ConvexProvider>,
    );

    expect(html).toContain("buy one extra share for every two you own at £1");
    expect(html).toContain("trading pauses while stakeholders purchase stock");
    expect(html).not.toContain("Single use. Activating takes one turn.");
    expect(html.match(/type="radio"/g)).toHaveLength(1);
    expect(html).toContain("aria-label=\"UB: 6,001 stocks\"");
    expect(html).not.toContain("aria-label=\"Natwest:");
    expect(html).toContain("disabled=\"\">Activate");
    expect(html).toContain(">Cancel</button>");
    await bob.mutation(api.rightsIssue.activate, command);
    expect((await bob.query(api.board.get, { code: "test" })).game.rightsIssue?.stockKey).toBe(8);
});

it("spends one bargain and returns to play when the chosen company has no shareholders", async () =>
{
    const { bob, board, command } = await fixture();

    await bob.mutation(api.rightsIssue.activate, { ...command, stockKey: 9 });
    const after = await bob.query(api.board.get, { code: "test" });

    expect(after.game.rightsIssue).toBeUndefined();
    expect(after.game.turn).toBe(7);
    expect(after.game.currentPeriod).toBe(1);
    expect(after.game.currentPlayerId).toBe(board.players[2]._id);
    expect(after.insights.find((card) => card._id === command.insightId)).toMatchObject({ used: true, resolved: true });
    expect(after.player.cash).toBe(10_000);
});
