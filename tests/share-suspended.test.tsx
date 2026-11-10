import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { roster } from "../../stockmarket-shared/src/npc-catalog";
import { api, internal } from "../convex/_generated/api";
import { pendingSuspensions } from "../shared/suspensions";
import { previewRound } from "../src/round-preview";
import { ShareSuspended, SuspensionStock } from "../src/ShareSuspended";
import { RoundEnd } from "../src/RoundEnd";
import { RoundPresentation } from "../src/spectator/RoundPresentation";
import { RoundOverview } from "../src/RoundOverview";
import { suspensionFixture } from "./suspension-setup";

const client = new ConvexReactClient("https://suspension-test.invalid");

it("orders physical cards by the period's rotated play order and filters used or old cards", async () =>
{
    const { board, samCard, bobCard } = await suspensionFixture();

    expect(pendingSuspensions(1, board.players, board.insights).map((card) => card._id)).toEqual([bobCard, samCard]);
    const used = board.insights.map((card) => card._id === bobCard ? { ...card, used: true } : card);

    expect(pendingSuspensions(1, board.players, used).map((card) => card._id)).toEqual([samCard]);
    expect(pendingSuspensions(2, board.players, board.insights)).toEqual([]);
    expect(pendingSuspensions(1, [], board.insights)).toEqual([]);
    expect(pendingSuspensions(1, board.players, [])).toEqual([]);
    expect(pendingSuspensions(1, board.players.filter((player) => player._id !== board.insights
        .find((card) => card._id === bobCard)!.playerId), board.insights).map((card) => card._id)).toEqual([samCard]);
});

it("enforces the phase, owner, queue, stock and period; spending freezes just one price at settlement", async () =>
{
    const { t, sam, bob, clients, outsider, board, samCard, bobCard } = await suspensionFixture();
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
    await t.run(async (context) => await context.db.patch(board.players[1]._id,
        { holdings: [{ stockKey: 8, quantity: 199_000 }] }));
    const trade = { code: "test", expectedPeriod: 2, expectedTurn: 0, stockKey: 8 };

    await expect(clients[2].mutation(api.trading.play, { ...trade, quantity: 2000 })).rejects.toThrow("Not enough shares available");
    await clients[2].mutation(api.trading.play, { ...trade, quantity: 1000 });
});

it("lets a public spectator skip only the current card and never carry it over", async () =>
{
    const { t, sam, samCard, bobCard } = await suspensionFixture();

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

const npcSuspensionTest = it.each(roster.map(({ id }) => id));

npcSuspensionTest("shows and resolves the %s NPC's suspension decision before the next player", async (personality) =>
{
    const { t, sam, board, bobCard, samCard } = await suspensionFixture();

    await t.run(async (context) => await context.db.patch(board.players[1]._id,
        { controller: { kind: "npc", personality }, userId: undefined }));
    const begin = { code: "test", expectedPeriod: 1 };

    await sam.mutation(api.rounds.beginSuspensions, begin);
    await sam.mutation(api.rounds.beginSuspensions, begin);
    const considering = await sam.query(api.board.get, { code: "test" });
    const preview = renderToStaticMarkup(
        <ConvexProvider client={client}><RoundEnd board={considering} /></ConvexProvider>,
    );

    expect(considering.game.suspended).toEqual([]);
    expect(preview).toContain("Stock valuations, ordered by volatility");
    expect(preview).not.toContain("suspension-holder-avatars");
    expect(preview).not.toContain("type=\"radio\"");

    const job = { gameId: board.game._id, insightId: bobCard };

    await t.mutation(internal.npc.suspensions.run, job);
    await t.mutation(internal.npc.suspensions.run, job);
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.game.suspended).toEqual([8]);
    expect(after.insights.find((card) => card._id === bobCard)?.used).toBe(true);
    expect(pendingSuspensions(1, after.players, after.insights)[0]._id).toBe(samCard);
    const summary = renderToStaticMarkup(
        <RoundOverview before={after} after={previewRound(after, after.insights, [8])} />,
    );

    expect(summary).toContain("Share Suspended · Stock price held");
});

it("shows the actor's holdings and both valuations, waiting portraits, and spectator portfolios after cash", async () =>
{
    const { sam, t, board, bobCard } = await suspensionFixture();
    const card = board.insights.find((item) => item._id === bobCard)!;
    const active = renderToStaticMarkup(<ShareSuspended board={board} card={card} own />);
    const waiting = renderToStaticMarkup(<ShareSuspended board={board} card={card} />);
    const spectator = renderToStaticMarkup(<ShareSuspended board={board} card={card} spectator />);

    expect(active).toContain("2,000 shares");
    expect(active).toContain("suspension-holder-avatars");
    expect(active).toContain("0 shares");
    expect(active).toContain("£2.50");
    expect(active).toContain("£1.50");
    expect(active).toContain("role=\"radiogroup\"");
    expect(active.indexOf("aria-label=\"Trusthouse Forte\"")).toBeLessThan(active.indexOf("aria-label=\"Natwest\""));
    expect(waiting).toContain("bob is deciding which stock valuation to suspend");
    expect(waiting).not.toContain("role=\"radiogroup\"");
    expect(waiting).not.toContain(">Suspend</button>");
    expect(waiting).not.toContain("suspension-holder-avatars");
    expect(spectator).toContain("Player portfolios");
    expect(spectator).not.toContain("suspension-quantity");
    expect(spectator).not.toContain("suspension-holder-avatars");
    expect(spectator).not.toContain("2,000 shares");
    expect(spectator).not.toContain("suspension-valuations");
    expect(spectator.indexOf(">worth</span>")).toBeLessThan(spectator.indexOf("suspension-change"));
    expect(spectator.indexOf("suspension-change")).toBeLessThan(spectator.indexOf(">new valuation</span>"));
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
    const { t, bob, board, samCard } = await suspensionFixture();

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
    const { t, board } = await suspensionFixture();

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
    vi.useFakeTimers();

    try
    {
        await t.mutation(api.rounds.beginSuspensions, { code: "test", expectedPeriod: 1 });
        await t.finishAllScheduledFunctions(vi.runAllTimers);
    }
    finally
    {
        vi.useRealTimers();
    }

    const publicBoard = (await t.query(api.tv.board, { code: "test" }))!;

    expect(publicBoard.reveal!.suspended).toEqual([]);
    expect(publicBoard.reveal!.insights.filter((card) => card.chanceKind === "hold").every((card) => card.used && card.resolved))
        .toBe(true);
});
