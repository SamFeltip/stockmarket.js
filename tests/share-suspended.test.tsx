import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chanceStockKey, specialDeck } from "../shared/chance-cards";
import { pendingSuspensions } from "../shared/suspensions";
import { previewRound } from "../src/round-preview";
import { ShareSuspended, SuspensionStock } from "../src/ShareSuspended";
import { RoundEnd } from "../src/RoundEnd";
import { RoundPresentation } from "../src/spectator/RoundPresentation";
import { setup } from "./game-setup";

const client = new ConvexReactClient("https://suspension-test.invalid");

async function fixture()
{
    const game = await setup();

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
        for (const [index, physical] of specialDeck().filter((card) => card.chanceKind === "hold").entries())
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

it("orders physical cards by the period's rotated play order and filters used or old cards", async () =>
{
    const { board, samCard, bobCard } = await fixture();

    expect(pendingSuspensions(1, board.players, board.insights).map((card) => card._id)).toEqual([bobCard, samCard]);
    const used = board.insights.map((card) => card._id === bobCard ? { ...card, used: true } : card);

    expect(pendingSuspensions(1, board.players, used).map((card) => card._id)).toEqual([samCard]);
    expect(pendingSuspensions(2, board.players, board.insights)).toEqual([]);
});

it("enforces the phase, owner, queue, stock and period; spending freezes just one price at settlement", async () =>
{
    const { t, sam, bob, outsider, board, samCard, bobCard } = await fixture();
    const arguments_ = { code: "test", expectedPeriod: 1, insightId: bobCard, stockKey: 8 };

    await expect(bob.mutation(api.rounds.suspendShare, arguments_)).rejects.toThrow("reveals are complete");
    await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 1 })).rejects.toThrow("Share Suspended");
    await sam.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    await expect(outsider.mutation(api.rounds.suspendShare, arguments_)).rejects.toThrow();
    await expect(sam.mutation(api.rounds.suspendShare, arguments_)).rejects.toThrow("Wait for your");
    await expect(sam.mutation(api.rounds.suspendShare, { ...arguments_, insightId: samCard })).rejects.toThrow("already changed");
    await expect(bob.mutation(api.rounds.suspendShare, { ...arguments_, expectedPeriod: 0 })).rejects.toThrow("round has already changed");
    await expect(bob.mutation(api.rounds.suspendShare, { ...arguments_, stockKey: -1 })).rejects.toThrow("tradable");
    await bob.mutation(api.rounds.suspendShare, arguments_);
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game.suspended).toEqual([8]);
    expect(after.game.turn).toBe(12); // This is a period-end choice, not an extra trading turn.
    expect(after.insights.find((card) => card._id === bobCard)).toMatchObject({ used: true, resolved: true });
    await expect(bob.mutation(api.rounds.suspendShare, arguments_)).rejects.toThrow("already changed");
    await expect(sam.mutation(api.rounds.suspendShare, { ...arguments_, insightId: samCard })).rejects.toThrow("already suspended");
    await sam.mutation(api.rounds.suspendShare, { ...arguments_, insightId: samCard, stockKey: undefined });
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 1 });
    const settled = await sam.query(api.board.get, { code: "test" });
    const beforeUb = board.game.prices.find((price) => price.stockKey === 8)!.value;

    expect(settled.game.prices.find((price) => price.stockKey === 8)!.value).toBe(beforeUb);
    expect(settled.game.prices.find((price) => price.stockKey === 12)!.value)
        .toBe(board.game.prices.find((price) => price.stockKey === 12)!.value + 1);
    expect(settled.players[1].cash).toBe(11_000);
    expect(settled.game.suspended).toEqual([]);
    expect(settled.game.suspensionPeriod).toBeUndefined();
    expect((await t.run(async (context) => await context.db.get(samCard)))?.used).toBe(true);
});

it("lets a public spectator skip only the current card and never carry it over", async () =>
{
    const { t, sam, samCard, bobCard } = await fixture();

    await t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    await expect(t.mutation(api.rounds.skipSuspension, { code: "test", expectedPeriod: 1, insightId: samCard }))
        .rejects.toThrow("already changed");
    await t.mutation(api.rounds.skipSuspension, { code: "test", expectedPeriod: 1, insightId: bobCard });
    await expect(t.mutation(api.rounds.skipSuspension, { code: "test", expectedPeriod: 1, insightId: bobCard }))
        .rejects.toThrow("already changed");
    await t.mutation(api.rounds.skipSuspension, { code: "test", expectedPeriod: 1, insightId: samCard });
    const before = await sam.query(api.board.get, { code: "test" });

    expect(before.insights.filter((card) => card.chanceKind === "hold").every((card) => card.used && card.resolved)).toBe(true);
    expect(before.game.suspended).toEqual([]);
    await t.mutation(api.rounds.nextSpectator, { code: "test", expectedPeriod: 1 });
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.insights.some((card) => card._id === samCard || card._id === bobCard)).toBe(false);
});

it("resolves NPC cards without blocking humans, protecting their greatest held loss", async () =>
{
    const { t, sam, board, bobCard, samCard } = await fixture();

    await t.run(async (context) => await context.db.patch(board.players[1]._id,
        { controller: { kind: "npc", personality: "felix" }, userId: undefined }));
    await sam.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game.suspended).toEqual([8]);
    expect(after.insights.find((card) => card._id === bobCard)?.used).toBe(true);
    expect(pendingSuspensions(1, after.players, after.insights)[0]._id).toBe(samCard);
});

it("shows the actor's holdings and both valuations, waiting portraits, and spectator portfolios after cash", async () =>
{
    const { sam, t, board, bobCard } = await fixture();
    const card = board.insights.find((item) => item._id === bobCard)!;
    const active = renderToStaticMarkup(<ShareSuspended board={board} card={card} own />);
    const waiting = renderToStaticMarkup(<ShareSuspended board={board} card={card} />);
    const spectator = renderToStaticMarkup(<ShareSuspended board={board} card={card} spectator />);

    expect(active).toContain("2,000 shares");
    expect(active).toContain("0 shares");
    expect(active).toContain("£2.50");
    expect(active).toContain("£1.50");
    expect(active).toContain("role=\"radiogroup\"");
    expect(active.indexOf("aria-label=\"Trusthouse Forte\"")).toBeLessThan(active.indexOf("aria-label=\"Natwest\""));
    expect(waiting).toContain("bob is deciding which stock valuation to suspend");
    expect(waiting).not.toContain("role=\"radiogroup\"");
    expect(waiting).not.toContain(">Suspend</button>");
    expect(spectator).toContain("Player portfolios");
    expect(spectator).toContain(">Skip</button>");
    expect(spectator).not.toContain("type=\"radio\"");
    const before = renderToStaticMarkup(<ConvexProvider client={client}><RoundEnd board={board} /></ConvexProvider>);

    expect(before).not.toContain("aria-label=\"Share Suspended decision\"");
    await t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    const started = await sam.query(api.board.get, { code: "test" });
    const phone = renderToStaticMarkup(<ConvexProvider client={client}><RoundEnd board={started} /></ConvexProvider>);
    const snapshot = (await t.query(api.tv.board, { code: "test" }))!;
    const display = renderToStaticMarkup(
        <ConvexProvider client={client}>
            <RoundPresentation
                snapshot={snapshot}
                busy={false}
                error=""
                onNext={() => undefined}
                onBack={() => undefined}
            />
        </ConvexProvider>,
    );

    expect(phone).toContain("Share Suspended decision");
    expect(phone).not.toContain("Round overview");
    expect(display).toContain("Player portfolios");
    const preview = previewRound(started, started.insights, [8, 12]);

    expect(preview.game.prices.find((price) => price.stockKey === 8)?.value).toBe(1.5);
    const chosen = renderToStaticMarkup(
        <SuspensionStock
            stock={board.stocks.find((stock) => stock.key === 8)!}
            quantity={2000}
            before={2.5}
            after={1.5}
            selected
            onSelect={() => undefined}
        />,
    );

    expect(chosen).toContain("class=\"suspension-stock is-selected");
    expect(chosen).toContain("checked=\"\"");
    expect(chosen).toContain("class=\"suspension-check\"");
    expect(chosen).toContain("d=\"m5 12 4 4 10-10\"");
    expect(chosen).toContain("aria-label=\"Price change: −£1.00\"");
    expect(chosen).toContain("stock_down.svg");
    expect(chosen).toContain("<span>worth</span><strong>£2.50</strong>");
    expect(chosen).toContain("<span>new valuation</span><strong>£1.50</strong>");
});

it("handles two physical cards owned by one player, zero-share choices, and final-period settlement", async () =>
{
    const { t, bob, board, samCard } = await fixture();

    await t.run(async (context) =>
    {
        await context.db.patch(samCard, { playerId: board.players[1]._id });
        await context.db.patch(board.game._id, { periodCount: 1 });
    });
    await t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    const before = await bob.query(api.board.get, { code: "test" });
    const queue = pendingSuspensions(1, before.players, before.insights);

    expect(queue).toHaveLength(2);
    expect(before.player.holdings.some((holding) => holding.stockKey === 12 && holding.quantity > 0)).toBe(false);
    await bob.mutation(api.rounds.suspendShare, { code: "test", expectedPeriod: 1, insightId: queue[0]._id, stockKey: 12 });
    const one = await bob.query(api.board.get, { code: "test" });

    expect(pendingSuspensions(1, one.players, one.insights)).toHaveLength(1);
    expect(one.insights.filter((card) => card.chanceKind === "hold" && card.used)).toHaveLength(1);
    await expect(t.mutation(api.rounds.nextSpectator, { code: "test", expectedPeriod: 1 })).rejects.toThrow("Share Suspended");
    await bob.mutation(api.rounds.suspendShare, { code: "test", expectedPeriod: 1, insightId: queue[1]._id, stockKey: 8 });
    await t.mutation(api.rounds.nextSpectator, { code: "test", expectedPeriod: 1 });
    const final = await bob.query(api.board.get, { code: "test" });

    expect(final.game.status).toBe("finished");
    expect(final.game.prices).toEqual(board.game.prices);
    expect(final.players[1].cash).toBe(11_000);
    await expect(bob.mutation(api.rounds.suspendShare,
        { code: "test", expectedPeriod: 1, insightId: queue[1]._id, stockKey: 8 })).rejects.toThrow("round has already changed");
});

it("rejects premature phases and lets consecutive NPC holders discard cards with no beneficial suspension", async () =>
{
    const { t, board } = await fixture();

    await t.run(async (context) => await context.db.patch(board.game._id, { status: "playing" }));
    await expect(t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 })).rejects.toThrow("round has already changed");
    await t.run(async (context) =>
    {
        await context.db.patch(board.game._id, { status: "closed" });

        for (const owner of board.players.slice(0, 2))
        {
            await context.db.patch(owner._id, { controller: { kind: "npc", personality: "felix" },
                userId: undefined, holdings: [] });
        }
    });
    await t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
    const publicBoard = (await t.query(api.tv.board, { code: "test" }))!;

    expect(publicBoard.reveal!.suspended).toEqual([]);
    expect(publicBoard.reveal!.insights.filter((card) => card.chanceKind === "hold").every((card) => card.used && card.resolved))
        .toBe(true);
});
