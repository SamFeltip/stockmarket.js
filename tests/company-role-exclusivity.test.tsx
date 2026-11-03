import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { companyRoles, roleQualification, withRoleBonuses } from "../shared/company-roles";
import { TradeModal } from "../src/TradeModal";
import { StockRoleFooter } from "../src/StockRoleFooter";
import { setup, skipDealtSuspensions } from "./game-setup";

const seat = (_id: string, quantity: number, order: number) => ({ _id,
    holdings: [{ stockKey: 8, quantity }], directorSince: [{ stockKey: 8, order }] });

it("keeps exactly one director by qualification order, independently of seat order and holding size", () =>
{
    const players = [seat("later", 80_000, 4), seat("first", 50_000, 1), seat("waiting", 60_000, 2)];

    expect(companyRoles(players, 8)).toEqual([{ playerId: "first", role: "director" }]);
    const after = players.map((player) => player._id === "first"
        ? { ...player, holdings: [{ stockKey: 8, quantity: 49_000 }] } : player);

    expect(companyRoles(after, 8)).toEqual([{ playerId: "waiting", role: "director" }]);
    const cards = players.map((player, index) => ({ _id: `card-${index}`, playerId: player._id,
        stockKey: 8, value: -index - 1, description: "Loss", resolved: false }));
    const bonuses = withRoleBonuses(cards, players, [{ key: 8, display: true }]).filter((card) => card.bonusRole);

    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]).toMatchObject({ playerId: "first", value: 2, bonusRole: "director" });
});

it("releases director priority on sale and puts a retiring chairman behind the incumbent director", () =>
{
    const chairman = { ...seat("chair", 100_000, 0), chairmanSince: [{ stockKey: 8, order: 0 }] };
    const director = seat("director", 50_000, 1);
    const demoted = { ...chairman, holdings: [{ stockKey: 8, quantity: 90_000 }],
        ...roleQualification(chairman, 8, 90_000, 5, "chairman") };

    expect(companyRoles([demoted, director], 8)).toEqual([{ playerId: "director", role: "director" }]);
    expect(demoted.chairmanSince).toEqual([]);
    expect(roleQualification(director, 8, 49_000, 6, "director").directorSince).toEqual([]);
    expect(companyRoles([seat("legacy-a", 50_000, 0), seat("legacy-b", 50_000, 0)]
        .map(({ directorSince: _priority, ...player }) => player), 8))
        .toEqual([{ playerId: "legacy-a", role: "director" }]);
});

it("preserves real trade incumbency, hands off vacancies, and reports assigned roles in buy and sell drawers", async () =>
{
    const { t, sam, bob, pat, lee } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        for (const player of initial.players)
        {
            await context.db.patch(player._id, { cash: 1_000_000 });
        }
    });
    const play = (client: typeof sam, turn: number, quantity?: number) => client.mutation(api.trading.play, {
        code: "test", expectedPeriod: 0, expectedTurn: turn,
        ...(quantity ? { stockKey: 8, quantity } : {}),
    });

    await play(sam, 0);
    await play(bob, 1, 50_000);
    await play(pat, 2, 50_000);
    await play(lee, 3);
    await play(sam, 4, 100_000);
    // Existing games did not store director priority: recover it from the actual trade sequence.
    await t.run(async (context) =>
    {
        for (const player of initial.players)
        {
            await context.db.patch(player._id, { directorSince: undefined });
        }
    });
    const assigned = await sam.query(api.board.get, { code: "test" });
    const stock = assigned.stocks.find((item) => item.key === 8)!;
    const publicBoard = (await t.query(api.tv.board, { code: "test" }))!;

    expect(assigned.players[0].roles).toContainEqual({ stockKey: 8, role: "chairman" });
    expect(assigned.players[1].roles).toContainEqual({ stockKey: 8, role: "director" });
    expect(assigned.players[2].roles).not.toContainEqual({ stockKey: 8, role: "director" });
    expect(publicBoard.players.flatMap((player) => player.roles.filter((role) => role.stockKey === 8)))
        .toEqual([{ stockKey: 8, role: "chairman" }, { stockKey: 8, role: "director" }]);
    const footer = renderToStaticMarkup(<StockRoleFooter board={assigned} stock={stock} />);

    expect(footer.match(/alt="Director"/g)).toHaveLength(1);
    expect(footer.match(/alt="Chairman"/g)).toHaveLength(1);
    const client = new ConvexReactClient("https://exclusive-roles.invalid");

    try
    {
        for (const mode of ["buy", "sell"] as const)
        {
            const html = renderToStaticMarkup(
                <ConvexProvider client={client}>
                    <TradeModal board={assigned} stock={stock} mode={mode} />
                </ConvexProvider>,
            );

            expect(html).toContain("Director role assigned");
            expect(html).toContain("Chairman role assigned");
            expect(html).not.toContain("stocks until director");
        }
    }
    finally
    {
        await client.close();
    }

    await play(bob, 5, -1000);
    await play(pat, 6);
    await play(lee, 7);
    await play(sam, 8, -10_000);
    await play(bob, 9, 1000);
    await play(pat, 10);
    await play(lee, 11);
    const closed = await sam.query(api.board.get, { code: "test" });

    expect(closed.players[2].roles).toContainEqual({ stockKey: 8, role: "director" });
    expect(closed.players[0].roles).not.toContainEqual({ stockKey: 8, role: "director" });
    expect(closed.players[1].roles).not.toContainEqual({ stockKey: 8, role: "director" });
    const lateBuy = closed.feed.find((event) => event.quantity === 1000 && event.title === "bob")!;

    expect(lateBuy.roleAfter).toBeUndefined();
    await skipDealtSuspensions(sam);
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    expect((await sam.query(api.board.get, { code: "test" })).players[2].roles)
        .toContainEqual({ stockKey: 8, role: "director" });
});

it("does not assign a second director when a Rights Issue purchase crosses the threshold", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });
    const insightId = await t.run(async (context) =>
    {
        await context.db.patch(board.player._id, { cash: 50_000, holdings: [{ stockKey: 8, quantity: 40_000 }] });
        await context.db.patch(board.players[1]._id, { holdings: [{ stockKey: 8, quantity: 50_000 }],
            directorSince: [{ stockKey: 8, order: -1 }] });

        return await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
            period: 0, stockKey: -2, chanceKind: "rights", value: 0, description: "Rights Issue", resolved: false });
    });

    await sam.mutation(api.rightsIssue.activate, {
        code: "test", expectedPeriod: 0, expectedTurn: 0, insightId, stockKey: 8,
    });
    await sam.mutation(api.rightsIssue.decide, { code: "test", insightId, expectedIndex: 0, quantity: 10_000 });
    const after = await sam.query(api.board.get, { code: "test" });
    const publicBoard = (await t.query(api.tv.board, { code: "test" }))!;

    expect(after.player.holdings[0].quantity).toBe(50_000);
    expect(after.players[0].roles).not.toContainEqual({ stockKey: 8, role: "director" });
    expect(after.players[1].roles).toContainEqual({ stockKey: 8, role: "director" });
    expect(publicBoard.players.flatMap((player) => player.roles.filter((role) => role.stockKey === 8)))
        .toEqual([{ stockKey: 8, role: "director" }]);
    expect(after.feed[0].roleAfter).toBeUndefined();
});
